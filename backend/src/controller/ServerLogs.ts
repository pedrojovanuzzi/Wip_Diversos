import path from "path";
import dotenv from "dotenv";
import { Response, Request } from "express";
import Client from "ssh2-sftp-client";
import zlib from "zlib";
import * as XLSX from "xlsx";
import pdf from "pdf-parse";
import { In } from "typeorm";
import MkauthSource from "../database/MkauthSource";
import { ClientesEntities } from "../entities/ClientesEntities";
import { Radacct } from "../entities/Radacct";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const config = {
  host: process.env.SERVER_LOGS,
  port: 22,
  username: process.env.SERVER_LOGS_LOGIN,
  password: process.env.SERVER_LOGS_PASSWORD,
};

const BASE_LOG_PATH = "/var/log/cgnat/syslog";

const MONTH_MAP: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

type JobStatus = "running" | "done" | "error";
interface JobState {
  id: string;
  status: JobStatus;
  totalFiles: number;
  processedFiles: number;
  hits: number;
  currentFile: string;
  message?: string;
  error?: string;
  buffer?: Buffer;
  filename?: string;
  createdAt: number;
  finishedAt?: number;
  ipFilter?: Set<string>;
}

const JOBS = new Map<string, JobState>();
const JOB_TTL_MS = 30 * 60 * 1000; // 30 minutos

function pruneJobs() {
  const now = Date.now();
  for (const [id, j] of JOBS) {
    const age = now - (j.finishedAt ?? j.createdAt);
    if (j.status !== "running" && age > JOB_TTL_MS) JOBS.delete(id);
  }
}

class ServerLogs {
  public async getFolders(req: Request, res: Response) {
    const sftp = new Client();
    try {
      await sftp.connect(config);
      const lista = await sftp.list("/var/log/cgnat/syslog");
      lista.sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR", { numeric: true }),
      );
      await sftp.end();
      res.status(200).send(lista.map((f) => f.name));
    } catch (error) {
      console.error(error);
      res.status(500).json(error);
      await sftp.end();
    } finally {
      try {
        await sftp.end();
      } catch (_) {
        await sftp.end();
      }
    }
  }

  public async FoldersRecursion(req: Request, res: Response) {
    const sftp = new Client();
    try {
      const { path } = req.body;
      await sftp.connect(config);
      const lista = await sftp.list(`${path}`);
      await sftp.end();
      lista.sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR", { numeric: true }),
      );
      res.status(200).send(lista.map((f) => f.name));
    } catch (error) {
      console.error(error);
      res.status(500).json(error);
      await sftp.end();
    } finally {
      try {
        await sftp.end();
      } catch (_) {
        await sftp.end();
      }
    }
  }

  public async AccessFile(req: Request, res: Response) {
    const sftp = new Client();
    try {
      const { path } = req.body;
      await sftp.connect(config);
      const result = await sftp.get(path);
      await sftp.end();

      if (Buffer.isBuffer(result)) {
        // é Buffer
        const content = path.endsWith(".gz")
          ? zlib.gunzipSync(result).toString("utf-8")
          : result.toString("utf-8");

        res.status(200).send({ content });
      } else {
        // é stream (se você usou destino em get)
        res
          .status(500)
          .json({ erro: "O resultado foi um stream, não um buffer" });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json(error);
      await sftp.end();
    } finally {
      try {
        await sftp.end();
      } catch (_) {
        await sftp.end();
      }
    }
  }

  public async SearchClientLogsStart(req: Request, res: Response) {
    try {
      pruneJobs();
      const body = req.body as Record<string, any>;
      const startDate: string | undefined = body.startDate;
      const endDate: string | undefined = body.endDate;

      // folders pode chegar como array (JSON) ou string serializada (multipart)
      let folders: string[] | undefined;
      if (Array.isArray(body.folders)) {
        folders = body.folders;
      } else if (typeof body.folders === "string") {
        try {
          const parsed = JSON.parse(body.folders);
          folders = Array.isArray(parsed) ? parsed : undefined;
        } catch (_) {
          folders = undefined;
        }
      }

      if (!startDate || !endDate) {
        res
          .status(400)
          .json({ error: "startDate e endDate são obrigatórios." });
        return;
      }
      if (!Array.isArray(folders) || folders.length === 0) {
        res
          .status(400)
          .json({ error: "Selecione pelo menos uma pasta para a busca." });
        return;
      }

      // Lista opcional de IPs Públicos fixos a inspecionar. Quando informada,
      // apenas os IPs Privados (CGNAT) cuja linha na tabela "MAPEAMENTO DAS
      // PORTAS" corresponda a um destes IPs Públicos serão considerados.
      const ipv4Re = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g;
      const fixedPublicIps = new Set<string>();
      const rawFixed = body.fixedIps;
      if (typeof rawFixed === "string" && rawFixed.trim() !== "") {
        const matches = rawFixed.match(ipv4Re) || [];
        for (const ip of matches) fixedPublicIps.add(ip);
      } else if (Array.isArray(rawFixed)) {
        for (const v of rawFixed) {
          if (typeof v !== "string") continue;
          const matches = v.match(ipv4Re) || [];
          for (const ip of matches) fixedPublicIps.add(ip);
        }
      }

      // Se PDFs foram enviados, extrai somente os IPs Privados (3ª coluna
      // da tabela MAPEAMENTO DAS PORTAS) e usa como filtro adicional.
      let ipFilter: Set<string> | undefined;
      const files =
        ((req as any).files as Express.Multer.File[] | undefined) || [];
      if (files.length > 0) {
        const ipRe = /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g;
        const rangeRe =
          /RANGE\s+IPs?\s+PRIVADOS?\s+PARA\s+CGNAT\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s*-\s*(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/i;
        // Linha da tabela: <IP Público> <portaStart> à <portaEnd> <IP Privado>
        const mapRowRe =
          /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s+\d{1,5}\s*(?:à|a|-)\s*\d{1,5}\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/gi;

        // Range CGNAT (RFC 6598): 100.64.0.0/10 → 100.64.x.x até 100.127.x.x
        const isCgnat = (a: number, b: number, c: number, d: number) => {
          if (a !== 100) return false;
          if (b < 64 || b > 127) return false;
          if (c < 0 || c > 255) return false;
          if (d < 0 || d > 255) return false;
          return true;
        };

        const ipToInt = (ip: string) => {
          const p = ip.split(".").map(Number);
          return ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
        };
        const intToIp = (n: number) =>
          `${(n >>> 24) & 0xff}.${(n >>> 16) & 0xff}.${(n >>> 8) & 0xff}.${n & 0xff}`;

        ipFilter = new Set<string>();
        const failedFiles: string[] = [];
        const useFixedFilter = fixedPublicIps.size > 0;

        for (const file of files) {
          if (!file.buffer || file.buffer.length === 0) continue;
          try {
            const parsed = await pdf(file.buffer);
            const text = parsed.text || "";

            if (useFixedFilter) {
              // Normaliza espaços (NBSP, tabs, quebras, zero-width).
              // Usa \uNNNN para evitar ranges acidentais no character class.
              const normalized = text.replace(/[    ​	]+/g, " ");

              // 1) Pareamento por proximidade de string: para cada
              // ocorrência literal do IP Público fixo, busca o próximo IP
              // CGNAT logo na sequência (até 200 caracteres à frente).
              const cgnatNearRe =
                /\b(100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3})\b/;
              for (const pub of fixedPublicIps) {
                let pos = 0;
                while (true) {
                  const idx = normalized.indexOf(pub, pos);
                  if (idx === -1) break;
                  const after = idx + pub.length;
                  const slice = normalized.slice(after, after + 200);
                  const cm = slice.match(cgnatNearRe);
                  if (cm) ipFilter.add(cm[1]);
                  pos = after;
                }
              }

              // 2) Reforço — tokeniza todos os IPv4 e pareia por sequência.
              const allIps: string[] = [];
              let im: RegExpExecArray | null;
              ipRe.lastIndex = 0;
              while ((im = ipRe.exec(normalized)) !== null) {
                allIps.push(`${im[1]}.${im[2]}.${im[3]}.${im[4]}`);
              }
              for (let i = 0; i < allIps.length; i++) {
                if (!fixedPublicIps.has(allIps[i])) continue;
                for (let j = i + 1; j < Math.min(i + 6, allIps.length); j++) {
                  const p = allIps[j].split(".").map(Number);
                  if (isCgnat(p[0], p[1], p[2], p[3])) {
                    ipFilter.add(allIps[j]);
                    break;
                  }
                }
              }

              // 3) Reforço — pareamento por linha completa.
              let m: RegExpExecArray | null;
              mapRowRe.lastIndex = 0;
              while ((m = mapRowRe.exec(text)) !== null) {
                const pub = m[1];
                const priv = m[2];
                if (!fixedPublicIps.has(pub)) continue;
                const p = priv.split(".").map(Number);
                if (!isCgnat(p[0], p[1], p[2], p[3])) continue;
                ipFilter.add(priv);
              }

              // Debug: registra no log do servidor o que foi extraído.
              const fixedFoundInPdf = Array.from(fixedPublicIps).filter((ip) =>
                normalized.includes(ip),
              );
              console.log(
                `[CGNAT/${file.originalname}] textLen=${text.length} ipv4Tokens=${allIps.length} fixedIps=${fixedPublicIps.size} fixedFoundInPdf=${fixedFoundInPdf.length} matchesAddedSoFar=${ipFilter.size}`,
              );
              if (fixedFoundInPdf.length === 0 && fixedPublicIps.size > 0) {
                console.log(
                  `[CGNAT/${file.originalname}] amostra do texto extraído (primeiros 500 chars):\n${normalized.slice(0, 500)}`,
                );
              }
              continue;
            }

            // Caminho rápido: PDFs do gerador CGNAT (Remontti) trazem o range no
            // cabeçalho — expande direto e evita depender da extração da tabela.
            const rm = rangeRe.exec(text);
            let usedRange = false;
            if (rm) {
              const startParts = rm[1].split(".").map(Number);
              const endParts = rm[2].split(".").map(Number);
              if (
                isCgnat(
                  startParts[0],
                  startParts[1],
                  startParts[2],
                  startParts[3],
                ) &&
                isCgnat(endParts[0], endParts[1], endParts[2], endParts[3])
              ) {
                const startN = ipToInt(rm[1]);
                const endN = ipToInt(rm[2]);
                if (endN >= startN && endN - startN < 1_000_000) {
                  for (let n = startN; n <= endN; n++) ipFilter.add(intToIp(n));
                  usedRange = true;
                }
              }
            }

            if (!usedRange) {
              let m: RegExpExecArray | null;
              ipRe.lastIndex = 0;
              while ((m = ipRe.exec(text)) !== null) {
                const a = Number(m[1]);
                const b = Number(m[2]);
                const c = Number(m[3]);
                const d = Number(m[4]);
                if (isCgnat(a, b, c, d)) {
                  ipFilter.add(`${a}.${b}.${c}.${d}`);
                }
              }
            }
          } catch (e: any) {
            console.error(`Falha ao ler PDF ${file.originalname}:`, e);
            failedFiles.push(file.originalname);
          }
        }

        if (ipFilter.size === 0) {
          const baseMsg =
            fixedPublicIps.size > 0
              ? "Nenhum IP Privado correspondente aos IPs Públicos informados foi encontrado nos PDFs."
              : "Nenhum IP CGNAT (100.64-127.x.x) foi encontrado nos PDFs.";
          res.status(400).json({
            error:
              failedFiles.length > 0
                ? `${baseMsg} Falha ao ler: ${failedFiles.join(", ")}`
                : baseMsg,
          });
          return;
        }
      } else if (fixedPublicIps.size > 0) {
        res.status(400).json({
          error:
            "Para filtrar por IPs Públicos fixos, envie também o(s) PDF(s) com a tabela de MAPEAMENTO DAS PORTAS.",
        });
        return;
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        start > end
      ) {
        res.status(400).json({ error: "Intervalo de datas inválido." });
        return;
      }

      const jobId =
        Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      const job: JobState = {
        id: jobId,
        status: "running",
        totalFiles: 0,
        processedFiles: 0,
        hits: 0,
        currentFile: "",
        message: "Conectando ao servidor de logs...",
        createdAt: Date.now(),
        ipFilter,
      };
      JOBS.set(jobId, job);

      // dispara processamento em background
      void runSearchJob(job, start, end, folders);

      res.status(202).json({
        jobId,
        ipFilterCount: ipFilter ? ipFilter.size : 0,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json(error);
    }
  }

  public async SearchClientLogsProgress(req: Request, res: Response) {
    const { jobId } = req.params;
    const job = JOBS.get(jobId);
    if (!job) {
      res.status(404).json({ error: "Job não encontrado." });
      return;
    }
    res.status(200).json({
      id: job.id,
      status: job.status,
      totalFiles: job.totalFiles,
      processedFiles: job.processedFiles,
      hits: job.hits,
      currentFile: job.currentFile,
      message: job.message,
      error: job.error,
      hasFile: !!job.buffer,
    });
  }

  public async SearchClientLogsDownload(req: Request, res: Response) {
    const { jobId } = req.params;
    const job = JOBS.get(jobId);
    if (!job) {
      res.status(404).json({ error: "Job não encontrado." });
      return;
    }
    if (job.status !== "done" || !job.buffer) {
      res.status(409).json({
        error: "Relatório ainda não está pronto.",
        status: job.status,
      });
      return;
    }
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${job.filename || `logs-clientes-${jobId}.xlsx`}`,
    );
    res.setHeader("X-Total-Hits", String(job.hits));
    res.setHeader("X-Files-Processed", String(job.processedFiles));
    res.status(200).send(job.buffer);
    // libera memória após o download
    job.buffer = undefined;
    job.finishedAt = Date.now();
  }
}

async function runSearchJob(
  job: JobState,
  start: Date,
  end: Date,
  folders: string[],
) {
  const sftp = new Client();
  try {
    await sftp.connect(config);

    job.message = "Listando arquivos...";
    const oneDay = 24 * 60 * 60 * 1000;
    const minMtime = start.getTime() - oneDay;
    const maxMtime = end.getTime() + oneDay;

    // Verifica se um prefixo de data (parcial: ano, ano+mês, ano+mês+dia)
    // possui interseção com o intervalo solicitado. Quando o prefixo é vazio,
    // não há restrição.
    const startY = start.getFullYear();
    const startM = start.getMonth() + 1;
    const startD = start.getDate();
    const endY = end.getFullYear();
    const endM = end.getMonth() + 1;
    const endD = end.getDate();

    const dayKey = (y: number, m: number, d: number) => y * 10000 + m * 100 + d;
    const startKey = dayKey(startY, startM, startD);
    const endKey = dayKey(endY, endM, endD);
    const monthKey = (y: number, m: number) => y * 100 + m;
    const startMK = monthKey(startY, startM);
    const endMK = monthKey(endY, endM);

    const dateOverlaps = (p: {
      y?: number;
      m?: number;
      d?: number;
    }): boolean => {
      if (p.y === undefined) return true;
      if (p.m === undefined) return p.y >= startY && p.y <= endY;
      const mk = monthKey(p.y, p.m);
      if (p.d === undefined) return mk >= startMK && mk <= endMK;
      const dk = dayKey(p.y, p.m, p.d);
      return dk >= startKey && dk <= endKey;
    };

    const allFiles: string[] = [];
    const walk = async (
      dir: string,
      prefix: { y?: number; m?: number; d?: number },
    ) => {
      let items: any[] = [];
      try {
        items = await sftp.list(dir);
      } catch (e) {
        console.error(`Falha ao listar ${dir}:`, e);
        return;
      }
      for (const it of items) {
        const full = `${dir}/${it.name}`;
        if (it.type === "d") {
          // tenta interpretar nome da pasta como componente de data
          const next = { ...prefix };
          const name = it.name;
          if (/^\d{4}$/.test(name) && next.y === undefined) {
            next.y = parseInt(name, 10);
          } else if (/^\d{1,2}$/.test(name)) {
            const num = parseInt(name, 10);
            if (
              next.y !== undefined &&
              next.m === undefined &&
              num >= 1 &&
              num <= 12
            ) {
              next.m = num;
            } else if (
              next.y !== undefined &&
              next.m !== undefined &&
              next.d === undefined &&
              num >= 1 &&
              num <= 31
            ) {
              next.d = num;
            }
          }
          if (!dateOverlaps(next)) continue;
          job.message = `Listando ${full}...`;
          await walk(full, next);
        } else if (it.type === "-") {
          const mtime = typeof it.modifyTime === "number" ? it.modifyTime : 0;
          if (mtime > 0 && (mtime < minMtime || mtime > maxMtime)) continue;
          allFiles.push(full);
          job.totalFiles = allFiles.length;
          job.message = `Encontrados ${allFiles.length} arquivo(s)...`;
        }
      }
    };
    for (const folder of folders) {
      const safe = String(folder).replace(/[^A-Za-z0-9_.\-]/g, "");
      if (!safe) continue;
      try {
        await walk(`${BASE_LOG_PATH}/${safe}`, {});
      } catch (e) {
        console.error(`Falha ao listar pasta ${safe}:`, e);
      }
    }
    job.totalFiles = allFiles.length;
    if (allFiles.length === 0) {
      job.message = "Nenhum arquivo no intervalo.";
    } else {
      job.message = `Processando ${allFiles.length} arquivo(s)...`;
    }

    const lineRe =
      /^([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+(\S+)\s+(\S+)\s+logged in,\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s+from\s+([0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){5})\s*$/;

    type Hit = {
      date: Date;
      host: string;
      login: string;
      ip: string;
      mac: string;
      sourceFile: string;
    };
    const hits: Hit[] = [];

    const buildDate = (
      monthIdx: number,
      day: number,
      hh: number,
      mm: number,
      ss: number,
    ): Date | null => {
      const candidates = [start.getFullYear(), end.getFullYear()];
      for (const y of candidates) {
        const d = new Date(y, monthIdx, day, hh, mm, ss);
        if (d >= start && d <= end) return d;
      }
      return null;
    };

    for (const file of allFiles) {
      job.currentFile = file;
      try {
        const result = await sftp.get(file);
        if (Buffer.isBuffer(result)) {
          const text = file.endsWith(".gz")
            ? zlib.gunzipSync(result).toString("utf-8")
            : result.toString("utf-8");
          const lines = text.split(/\r?\n/);
          for (const line of lines) {
            const m = lineRe.exec(line);
            if (!m) continue;
            const [, mon, day, hh, mm, ss, host, login, ip, mac] = m;
            const monthIdx = MONTH_MAP[mon];
            if (monthIdx === undefined) continue;
            const d = buildDate(
              monthIdx,
              parseInt(day, 10),
              parseInt(hh, 10),
              parseInt(mm, 10),
              parseInt(ss, 10),
            );
            if (!d) continue;
            hits.push({
              date: d,
              host,
              login,
              ip,
              mac: mac.toUpperCase(),
              sourceFile: file,
            });
          }
        }
      } catch (e) {
        console.error(`Falha ao ler ${file}:`, e);
      }
      job.processedFiles += 1;
      job.hits = hits.length;
    }

    try {
      await sftp.end();
    } catch (_) {
      /* noop */
    }

    job.message = "Validando sessões no MKAuth (radacct)...";
    const uniqueLogins = Array.from(new Set(hits.map((h) => h.login)));

    // Carrega sessões candidatas: qualquer sessão de algum dos logins que
    // tenha alguma sobreposição com o intervalo solicitado.
    type SessionRow = {
      username: string;
      framedipaddress: string | null;
      acctstarttime: Date | null;
      acctstoptime: Date | null;
    };
    const sessionsByLoginIp = new Map<string, SessionRow[]>();
    if (uniqueLogins.length > 0) {
      const RadacctRepo = MkauthSource.getRepository(Radacct);
      const sessions = await RadacctRepo.createQueryBuilder("r")
        .select([
          "r.username",
          "r.framedipaddress",
          "r.acctstarttime",
          "r.acctstoptime",
        ])
        .where("r.username IN (:...logins)", { logins: uniqueLogins })
        .andWhere("r.acctstarttime >= :start", { start })
        .andWhere("r.acctstoptime <= :end", { end })
        .getMany();
      for (const s of sessions as unknown as SessionRow[]) {
        const key = `${s.username}|${s.framedipaddress || ""}`;
        const arr = sessionsByLoginIp.get(key) || [];
        arr.push(s);
        sessionsByLoginIp.set(key, arr);
      }
    }

    // Aplica filtro de IPs vindos do PDF, se houver
    if (job.ipFilter && job.ipFilter.size > 0) {
      const before = hits.length;
      const filtered = hits.filter((h) => job.ipFilter!.has(h.ip));
      hits.length = 0;
      hits.push(...filtered);
      job.message = `Filtrados por PDF: ${filtered.length}/${before} ocorrências.`;
    }

    // Filtra os hits: só mantemos aquelas ocorrências cujo (login, ip, data)
    // está coberto por uma sessão (acctstarttime <= data <= acctstoptime).
    type ValidatedHit = (typeof hits)[number] & {
      sessionStart: Date | null;
      sessionStop: Date | null;
    };
    const validatedHits: ValidatedHit[] = [];
    for (const h of hits) {
      const key = `${h.login}|${h.ip}`;
      const sess = sessionsByLoginIp.get(key);
      if (!sess || sess.length === 0) continue;
      const t = h.date.getTime();
      const userStartT = start.getTime();
      const userEndT = end.getTime();
      const match = sess.find((s) => {
        const startT = s.acctstarttime
          ? new Date(s.acctstarttime).getTime()
          : null;
        const stopT = s.acctstoptime
          ? new Date(s.acctstoptime).getTime()
          : null;
        if (startT === null || stopT === null) return false;
        // Sessão totalmente dentro da faixa selecionada
        if (startT < userStartT || stopT > userEndT) return false;
        // E o horário do log está dentro da sessão
        if (startT > t || stopT < t) return false;
        return true;
      });
      if (!match) continue;
      validatedHits.push({
        ...h,
        sessionStart: match.acctstarttime
          ? new Date(match.acctstarttime)
          : null,
        sessionStop: match.acctstoptime ? new Date(match.acctstoptime) : null,
      });
    }

    job.hits = validatedHits.length;
    job.message = "Buscando dados dos clientes no MKAuth...";

    const clienteMap = new Map<string, ClientesEntities>();
    const validatedLogins = Array.from(
      new Set(validatedHits.map((h) => h.login)),
    );
    if (validatedLogins.length > 0) {
      const ClientRepository = MkauthSource.getRepository(ClientesEntities);
      const clientes = await ClientRepository.find({
        where: { login: In(validatedLogins) },
      });
      for (const c of clientes) {
        if (c.login) clienteMap.set(c.login, c);
      }
    }

    const pad = (n: number) => String(n).padStart(2, "0");
    const formatDate = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
      `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    const buildEndereco = (c?: ClientesEntities) => {
      if (!c) return "";
      const partes = [
        c.endereco,
        c.numero ? `nº ${c.numero}` : "",
        c.complemento,
        c.bairro,
        c.cidade && c.estado ? `${c.cidade}/${c.estado}` : c.cidade || c.estado,
        c.cep ? `CEP ${c.cep}` : "",
      ].filter((p) => p && String(p).trim() !== "");
      return partes.join(", ");
    };

    const modalidade = (c?: ClientesEntities) => {
      if (!c) return "Desconhecida";
      const ipFixo = c.ip && String(c.ip).trim() !== "" && c.ip !== "0.0.0.0";
      return ipFixo ? "IP Fixo" : "IP Compartilhado (CGNAT)";
    };

    job.message = "Gerando planilha Excel...";

    // Agrupa por login: hits do mesmo dia cujo intervalo entre conexões
    // consecutivas seja <= GAP_MS são consolidados em 1 linha (início → fim).
    const GAP_MS = 60 * 60 * 1000; // 1h
    const sortedHits = [...validatedHits].sort(
      (a, b) =>
        a.login.localeCompare(b.login) || a.date.getTime() - b.date.getTime(),
    );

    type Group = {
      login: string;
      start: Date;
      end: Date;
      hits: typeof sortedHits;
    };
    const groups: Group[] = [];
    for (const h of sortedHits) {
      const last = groups[groups.length - 1];
      const sameDay =
        last &&
        last.login === h.login &&
        last.end.getFullYear() === h.date.getFullYear() &&
        last.end.getMonth() === h.date.getMonth() &&
        last.end.getDate() === h.date.getDate();
      if (last && sameDay && h.date.getTime() - last.end.getTime() <= GAP_MS) {
        last.end = h.date;
        last.hits.push(h);
      } else {
        groups.push({ login: h.login, start: h.date, end: h.date, hits: [h] });
      }
    }
    groups.sort((a, b) => a.start.getTime() - b.start.getTime());

    const uniqJoin = (vals: (string | undefined | null)[]) =>
      Array.from(
        new Set(vals.map((v) => (v ?? "").toString()).filter((v) => v !== "")),
      ).join(", ");

    const rows = groups.map((g) => {
      const c = clienteMap.get(g.login);
      const single = g.hits.length === 1;
      const starts = g.hits
        .map((h) => h.sessionStart)
        .filter(Boolean) as Date[];
      const stops = g.hits.map((h) => h.sessionStop);
      const sessionStart = starts.length
        ? new Date(Math.min(...starts.map((d) => d.getTime())))
        : null;
      const hasActive = stops.some((s) => !s);
      const stopDates = stops.filter(Boolean) as Date[];
      const sessionStop = hasActive
        ? null
        : stopDates.length
          ? new Date(Math.max(...stopDates.map((d) => d.getTime())))
          : null;

      return {
        "Data/Hora Início": formatDate(g.start),
        "Data/Hora Fim": single ? "" : formatDate(g.end),
        Conexões: g.hits.length,
        "Nome Completo": c?.nome || "",
        Login: g.login,
        "CPF/CNPJ": c?.cpf_cnpj || "",
        "Endereço Completo": buildEndereco(c),
        "Dados do Termo": c?.termo || "",
        "Modalidade da Conexão": modalidade(c),
        "IP Encontrado (CGNAT)": uniqJoin(g.hits.map((h) => h.ip)),
        "IP Fixo Cadastrado": c?.ip || "",
        MAC: uniqJoin(g.hits.map((h) => h.mac)),
        "NAS/Concentrador": uniqJoin(g.hits.map((h) => h.host)),
        "Sessão Início (radacct)": sessionStart ? formatDate(sessionStart) : "",
        "Sessão Fim (radacct)": hasActive
          ? "ativa"
          : sessionStop
            ? formatDate(sessionStop)
            : "",
        "Arquivo de Origem": uniqJoin(g.hits.map((h) => h.sourceFile)),
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const headers = Object.keys(rows[0] || {});
    ws["!cols"] = headers.map((h) => ({
      wch: Math.min(
        60,
        Math.max(
          h.length + 2,
          ...rows.map((r) => String((r as any)[h] ?? "").length + 2),
        ),
      ),
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Logs Clientes");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    job.buffer = buffer;
    job.filename = `logs-clientes-${stamp}.xlsx`;
    job.status = "done";
    job.message = "Concluído.";
    job.finishedAt = Date.now();
  } catch (error: any) {
    console.error("Erro no job de busca de logs:", error);
    job.status = "error";
    job.error = error?.message || "Erro desconhecido";
    job.finishedAt = Date.now();
    try {
      await sftp.end();
    } catch (_) {
      /* noop */
    }
  }
}

export default ServerLogs;
