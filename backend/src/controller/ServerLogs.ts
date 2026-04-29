import path from "path";
import dotenv from "dotenv";
import { Response, Request } from "express";
import Client from "ssh2-sftp-client";
import zlib from "zlib";
import * as XLSX from "xlsx";
import { In } from "typeorm";
import MkauthSource from "../database/MkauthSource";
import { ClientesEntities } from "../entities/ClientesEntities";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const config = {
  host: process.env.SERVER_LOGS,
  port: 22,
  username: process.env.SERVER_LOGS_LOGIN,
  password: process.env.SERVER_LOGS_PASSWORD,
};

const BASE_LOG_PATH = "/var/log/cgnat/syslog";

const MONTH_MAP: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
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
        a.name.localeCompare(b.name, "pt-BR", { numeric: true })
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
        a.name.localeCompare(b.name, "pt-BR", { numeric: true })
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
      const { startDate, endDate, folders } = req.body as {
        startDate?: string;
        endDate?: string;
        folders?: string[];
      };

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
      };
      JOBS.set(jobId, job);

      // dispara processamento em background
      void runSearchJob(job, start, end, folders);

      res.status(202).json({ jobId });
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
      res
        .status(409)
        .json({ error: "Relatório ainda não está pronto.", status: job.status });
      return;
    }
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${job.filename || `logs-clientes-${jobId}.xlsx`}`
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
  folders: string[]
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

    const dayKey = (y: number, m: number, d: number) =>
      y * 10000 + m * 100 + d;
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
      prefix: { y?: number; m?: number; d?: number }
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
            if (next.y !== undefined && next.m === undefined && num >= 1 && num <= 12) {
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
      ss: number
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
              parseInt(ss, 10)
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

    job.message = "Buscando dados dos clientes no MKAuth...";
    const uniqueLogins = Array.from(new Set(hits.map((h) => h.login)));
    const clienteMap = new Map<string, ClientesEntities>();
    if (uniqueLogins.length > 0) {
      const ClientRepository = MkauthSource.getRepository(ClientesEntities);
      const clientes = await ClientRepository.find({
        where: { login: In(uniqueLogins) },
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
    const rows = hits
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((h) => {
        const c = clienteMap.get(h.login);
        return {
          "Data/Hora": formatDate(h.date),
          "Nome Completo": c?.nome || "",
          Login: h.login,
          "CPF/CNPJ": c?.cpf_cnpj || "",
          "Endereço Completo": buildEndereco(c),
          "Dados do Termo": c?.termo || "",
          "Modalidade da Conexão": modalidade(c),
          "IP Encontrado (CGNAT)": h.ip,
          "IP Fixo Cadastrado": c?.ip || "",
          MAC: h.mac,
          "NAS/Concentrador": h.host,
          "Arquivo de Origem": h.sourceFile,
        };
      });

    const ws = XLSX.utils.json_to_sheet(rows);
    const headers = Object.keys(rows[0] || {});
    ws["!cols"] = headers.map((h) => ({
      wch: Math.min(
        60,
        Math.max(
          h.length + 2,
          ...rows.map((r) => String((r as any)[h] ?? "").length + 2)
        )
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
