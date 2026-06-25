import MkauthSource from "../database/MkauthSource";
import { ClientesEntities } from "../entities/ClientesEntities";
import { Faturas } from "../entities/Faturas";
import { Request, Response } from "express";
import { Radacct } from "../entities/Radacct";
import { Between, In, LessThanOrEqual } from "typeorm";
import { Telnet } from "telnet-client";
import { Client } from "ssh2";
import axios from "axios";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const servidores = [
  { host: process.env.MIKROTIK_PPPOE1, nome: "PPPOE1" },
  { host: process.env.MIKROTIK_PPPOE2, nome: "PPPOE2" },
  { host: process.env.MIKROTIK_PPPOE3, nome: "PPPOE3" },
  { host: process.env.MIKROTIK_PPPOE4, nome: "PPPOE4" },
];

// Integração com o painel do mkauth (botão "Reparar")
const MKAUTH_URL = process.env.MKAUTH_URL; // ex: https://mk.seudominio.com.br
const MKAUTH_COOKIE = process.env.MKAUTH_COOKIE; // (opcional) cookie fixo de fallback

// Sessão obtida via login no popup, guardada em memória (não persiste senha).
let mkauthSession: string | null = null;

function parseSetCookie(setCookie?: string[] | string): Record<string, string> {
  const map: Record<string, string> = {};
  if (!setCookie) return map;
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const c of arr) {
    const first = c.split(";")[0];
    const eq = first.indexOf("=");
    if (eq > 0) map[first.slice(0, eq).trim()] = first.slice(eq + 1).trim();
  }
  return map;
}

function cookieHeader(map: Record<string, string>): string {
  return Object.entries(map)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

// Extrai os campos do form de login (inclui os dinâmicos e o ttoken).
function extrairCamposLogin(html: string): Record<string, string> {
  const campos: Record<string, string> = {};
  let escopo = html;
  const form = html.match(
    /<form[^>]*executar_login[\s\S]*?<\/form>/i,
  );
  if (form) escopo = form[0];
  const inputs = escopo.match(/<input\b[^>]*>/gi) || [];
  for (const tag of inputs) {
    const name = (tag.match(/name\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (!name) continue;
    const value = (tag.match(/value\s*=\s*["']([^"']*)["']/i) || [])[1] ?? "";
    campos[name] = value;
  }
  return campos;
}

// Extrai os valores do "Sou Ser Humano" (captcha) do script inline da login.
// No HTML os inputs vêm value="0"; os valores reais ficam no ramo if(checked).
function extrairCaptchaHuman(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const bloco = html.match(
    /prop\(\s*["']checked["']\s*\)\s*\)\s*\{([\s\S]*?)\}\s*else/i,
  );
  if (!bloco) return out;
  const re = /["']#([^"']+)["']\s*\)\s*\.val\(\s*['"]([^'"]*)['"]\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(bloco[1])) !== null) {
    out[m[1]] = m[2];
  }
  return out;
}

// Faz o login no painel do mkauth e retorna o header Cookie autenticado.
async function fazerLoginMkauth(
  usuario: string,
  senha: string,
  ga: string = "",
): Promise<string> {
  if (!MKAUTH_URL) throw new Error("MKAUTH_URL não configurado");

  // 1) Página de login: cookies pré-sessão + campos dinâmicos + ttoken.
  const getResp = await axios.get(`${MKAUTH_URL}/admin/login.hhvm`, {
    headers: { "User-Agent": "Mozilla/5.0" },
    timeout: 30000,
    maxRedirects: 0,
    validateStatus: (s) => s >= 200 && s < 400,
  });

  const html = typeof getResp.data === "string" ? getResp.data : "";
  const cookiesPre = parseSetCookie(getResp.headers["set-cookie"]);
  const campos = extrairCamposLogin(html);

  // Captcha "Sou Ser Humano": aplica os valores reais dos campos dinâmicos.
  Object.assign(campos, extrairCaptchaHuman(html));

  // 2) Credenciais: usuário em base64, senha em SHA-256 (como o painel faz).
  campos["login"] = Buffer.from(usuario).toString("base64");
  campos["password"] = crypto.createHash("sha256").update(senha).digest("hex");
  campos["cookie"] = "nao";
  campos["ga"] = ga || "";

  const body = Object.entries(campos)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  // 3) Envia o login.
  const postResp = await axios.post(
    `${MKAUTH_URL}/admin/executar_login.hhvm`,
    body,
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookieHeader(cookiesPre),
        Origin: MKAUTH_URL,
        Referer: `${MKAUTH_URL}/admin/login.hhvm`,
        "User-Agent": "Mozilla/5.0",
      },
      timeout: 30000,
      maxRedirects: 0,
      validateStatus: () => true,
    },
  );

  const cookiesPos = parseSetCookie(postResp.headers["set-cookie"]);
  const merged = { ...cookiesPre, ...cookiesPos };

  if (!Object.keys(merged).some((k) => k.includes("-MKA"))) {
    throw new Error("Login não retornou sessão do mkauth");
  }

  // Valida de verdade: acessa uma página protegida. Se cair no login, falhou.
  const verif = await axios.get(`${MKAUTH_URL}/admin/clientes.hhvm?tipo=todos`, {
    headers: { Cookie: cookieHeader(merged), "User-Agent": "Mozilla/5.0" },
    maxRedirects: 0,
    validateStatus: () => true,
    timeout: 30000,
  });
  const corpoVerif = typeof verif.data === "string" ? verif.data : "";
  const caiuNoLogin =
    verif.status >= 300 ||
    /executar_login|login\.hhvm|name=["']password["']/i.test(corpoVerif);
  if (caiuNoLogin) {
    throw new Error(
      "Sessão não autenticou (usuário/senha ou esquema de hash incorretos).",
    );
  }

  return cookieHeader(merged);
}

class ClientAnalytics {
  private clientIp: string | undefined;
  private serverIp: string | undefined;
  private versao: string | undefined | number;
  private onuId: string | undefined;

  info = async (req: Request, res: Response) => {
    try {
      const { pppoe } = req.body;
      const ClientesRepository = MkauthSource.getRepository(ClientesEntities);
      let User = await ClientesRepository.find({
        where: { login: pppoe, cli_ativado: "s" },
      });

      if (User.length < 1) {
        res
          .status(500)
          .json({ error: "Cliente não existe, ou está desativado" });
      }

      const FaturasRepository = MkauthSource.getRepository(Faturas);

      const hoje = new Date();

      const limiteInferior = new Date();
      limiteInferior.setMonth(hoje.getMonth() - 3);

      const limiteSuperior = new Date();
      limiteSuperior.setDate(hoje.getDate() - 15);

      const FaturaDoMes = await FaturasRepository.find({
        where: {
          login: pppoe,
          status: "vencido",
          datavenc: Between(limiteInferior, limiteSuperior),
        },
      });

      const suspensao = FaturaDoMes.length > 0;

      res.status(200).json({ user: User, suspensao: suspensao });
      return;
    } catch (error) {
      error;
    }
  };

  clientList = async (req: Request, res: Response) => {
    try {
      const resultados = [];

      for (const servidor of servidores) {
        try {
          const comando = `/ppp active print without-paging detail`;
          const resposta = await this.executarSSH(servidor.host!, comando);

          const regex =
            /name="([^"]+)"\s+service=pppoe\s+caller-id="([0-9A-F:]+)"\s+address=(\d+\.\d+\.\d+\.\d+)\s+uptime=((?:\d+y)?(?:\d+mo)?(?:\d+w)?(?:\d+d)?(?:\d+h)?(?:\d+m)?(?:\d+s)?|\d+)/gim;

          const matches = [...resposta.matchAll(regex)];

          for (const match of matches) {
            let [, pppoe, callerId, ip, upTime] = match;

            if (/^\d+$/.test(upTime)) {
              upTime = `${upTime}d`;
            }

            resultados.push({
              servidor: servidor.nome,
              pppoe,
              callerId,
              ip,
              upTime: upTime,
            });
          }
        } catch (err: any) {
          resultados.push({
            servidor: servidor.nome,
            erro: err.message || "Erro desconhecido",
          });
        }
      }

      res.status(200).json(resultados);
    } catch (error) {
      res.status(500).json(error);
    }
  };

  clientsWithoutQueue = async (req: Request, res: Response) => {
    try {
      const resultados: any[] = [];

      for (const servidor of servidores) {
        try {
          // 1) Clientes PPPoE conectados
          const comandoAtivos = `/ppp active print without-paging detail`;
          const respostaAtivos = await this.executarSSH(
            servidor.host!,
            comandoAtivos,
          );

          const regexAtivos =
            /name="([^"]+)"\s+service=pppoe\s+caller-id="([0-9A-F:]+)"\s+address=(\d+\.\d+\.\d+\.\d+)\s+uptime=((?:\d+y)?(?:\d+mo)?(?:\d+w)?(?:\d+d)?(?:\d+h)?(?:\d+m)?(?:\d+s)?|\d+)/gim;

          const ativos = [...respostaAtivos.matchAll(regexAtivos)].map(
            (match) => {
              let [, pppoe, callerId, ip, upTime] = match;
              if (/^\d+$/.test(upTime)) upTime = `${upTime}d`;
              return { pppoe, callerId, ip, upTime };
            },
          );

          // 2) Filas (simple queues) existentes no servidor
          const comandoQueues = `/queue simple print without-paging detail`;
          const respostaQueues = await this.executarSSH(
            servidor.host!,
            comandoQueues,
          );

          const nomesNaQueue = new Set<string>();

          // As filas PPPoE são dinâmicas e vêm como name="<pppoe-LOGIN>".
          // Extraímos somente o LOGIN para comparar pelo PPPoE.
          for (const m of respostaQueues.matchAll(/name="([^"]+)"/gim)) {
            const bruto = m[1].trim();
            const login = bruto
              .replace(/^<pppoe-/i, "")
              .replace(/>$/, "")
              .trim()
              .toLowerCase();
            if (login) nomesNaQueue.add(login);
          }

          // 3) Conectados que NÃO possuem fila (comparação somente por PPPoE)
          for (const cliente of ativos) {
            const temQueue = nomesNaQueue.has(cliente.pppoe.toLowerCase());

            if (!temQueue) {
              resultados.push({
                servidor: servidor.nome,
                pppoe: cliente.pppoe,
                callerId: cliente.callerId,
                ip: cliente.ip,
                upTime: cliente.upTime,
              });
            }
          }
        } catch (err: any) {
          resultados.push({
            servidor: servidor.nome,
            erro: err.message || "Erro desconhecido",
          });
        }
      }

      // Enriquece com o plano de cada cliente (busca única no sis_cliente).
      const logins = resultados
        .filter((r) => r.pppoe)
        .map((r) => r.pppoe as string);

      if (logins.length > 0) {
        try {
          const repo = MkauthSource.getRepository(ClientesEntities);
          const registros = await repo.find({
            where: { login: In(logins) },
            select: ["login", "plano"],
          });

          const mapa = new Map(
            registros.map((c) => [String(c.login).toLowerCase(), c.plano ?? ""]),
          );

          for (const r of resultados) {
            if (r.pppoe) {
              r.plano = mapa.get(String(r.pppoe).toLowerCase()) ?? "";
            }
          }
        } catch (errPlano) {
          // Se falhar a consulta de planos, segue sem o campo.
        }
      }

      res.status(200).json(resultados);
    } catch (error) {
      res.status(500).json(error);
    }
  };

  observacao = async (req: Request, res: Response) => {
    try {
      const { pppoe, observar } = req.body;

      if (!pppoe) {
        res.status(400).json({ error: "pppoe é obrigatório" });
        return;
      }

      const repo = MkauthSource.getRepository(ClientesEntities);
      const user = await repo.findOne({
        where: { login: pppoe },
        order: { id: "ASC" },
      });

      if (!user) {
        res.status(404).json({ error: "Cliente não encontrado" });
        return;
      }

      if (observar) {
        // Liga a observação. O mkauth trata rem_obs por dia (grava à meia-noite),
        // então usamos a data de hoje como marca de "em observação".
        const hoje = new Date();
        const remObs = `${hoje.getFullYear()}-${String(
          hoje.getMonth() + 1,
        ).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;

        await repo.update(
          { id: user.id },
          { observacao: "sim", rem_obs: remObs as any },
        );

        res.status(200).json({ observacao: "sim", rem_obs: remObs });
        return;
      }

      // Desliga a observação.
      await repo.update(
        { id: user.id },
        { observacao: "nao", rem_obs: null as any },
      );

      res.status(200).json({ observacao: "nao", rem_obs: null });
    } catch (error) {
      res.status(500).json({
        error: "Erro ao atualizar observação",
        detalhes: String(error),
      });
    }
  };

  subirCliente = async (req: Request, res: Response) => {
    try {
      const { pppoe } = req.body;

      if (!pppoe) {
        res.status(400).json({ error: "pppoe é obrigatório" });
        return;
      }

      const repo = MkauthSource.getRepository(ClientesEntities);
      const user = await repo.findOne({
        where: { login: pppoe },
        order: { id: "ASC" },
      });

      if (!user) {
        res.status(404).json({ error: "Cliente não encontrado" });
        return;
      }

      // 1) Redução: força o estado para o mkauth re-sincronizar com o MikroTik.
      await repo.update(
        { id: user.id },
        { status_corte: "down", statusdown: "on" },
      );

      // 2) Aguarda 30s para o cliente cair em redução antes de restaurar.
      await new Promise((resolve) => setTimeout(resolve, 30000));

      // 3) Observação: volta para velocidade normal e marca em observação.
      const hoje = new Date();
      const remObs = `${hoje.getFullYear()}-${String(
        hoje.getMonth() + 1,
      ).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;

      try {
        await repo.update(
          { id: user.id },
          {
            status_corte: "full",
            statusdown: "off",
            observacao: "sim",
            rem_obs: remObs as any,
          },
        );
      } catch (errFinal) {
        // Se a restauração falhar, tenta ao menos tirar o cliente da redução.
        await repo
          .update({ id: user.id }, { status_corte: "full", statusdown: "off" })
          .catch(() => {});
        throw errFinal;
      }

      res
        .status(200)
        .json({ ok: true, observacao: "sim", rem_obs: remObs });
    } catch (error) {
      res.status(500).json({
        error: "Erro ao subir cliente",
        detalhes: String(error),
      });
    }
  };

  derrubarPppoe = async (req: Request, res: Response) => {
    try {
      if ((req.user?.permission ?? 0) < 5) {
        res.status(403).json({ error: "Permissão insuficiente" });
        return;
      }

      const { pppoe, servidor } = req.body;

      if (!pppoe || !/^[a-zA-Z0-9._-]+$/.test(pppoe)) {
        res.status(400).json({ error: "pppoe inválido" });
        return;
      }

      // Coloca o cliente em observação por 1 dia (rem_obs = amanhã).
      // Best-effort: se falhar, não impede o desligamento.
      let observado = false;
      try {
        const repo = MkauthSource.getRepository(ClientesEntities);
        const user = await repo.findOne({
          where: { login: pppoe },
          order: { id: "ASC" },
        });
        if (user) {
          const amanha = new Date();
          amanha.setDate(amanha.getDate() + 1);
          const remObs = `${amanha.getFullYear()}-${String(
            amanha.getMonth() + 1,
          ).padStart(2, "0")}-${String(amanha.getDate()).padStart(2, "0")}`;

          await repo.update(
            { id: user.id },
            { observacao: "sim", rem_obs: remObs as any },
          );
          observado = true;
        }
      } catch (errObs) {
        observado = false;
      }

      const comando = `/ppp active remove [find name="${pppoe}"]`;

      // Se souber o servidor, derruba só nele; senão tenta em todos.
      const alvos = servidor
        ? servidores.filter((s) => s.nome === servidor)
        : servidores;

      if (alvos.length === 0) {
        res.status(404).json({ error: "Servidor não encontrado" });
        return;
      }

      const resultados: any[] = [];
      for (const srv of alvos) {
        try {
          await this.executarSSH(srv.host!, comando);
          resultados.push({ servidor: srv.nome, ok: true });
        } catch (err: any) {
          resultados.push({
            servidor: srv.nome,
            ok: false,
            erro: err.message || "Erro desconhecido",
          });
        }
      }

      res.status(200).json({ ok: true, observado, resultados });
    } catch (error) {
      res.status(500).json({
        error: "Erro ao derrubar PPPoE",
        detalhes: String(error),
      });
    }
  };

  mkauthLogin = async (req: Request, res: Response) => {
    try {
      if ((req.user?.permission ?? 0) < 5) {
        res.status(403).json({ error: "Permissão insuficiente" });
        return;
      }

      if (!MKAUTH_URL) {
        res.status(500).json({
          error: "Integração mkauth não configurada. Defina MKAUTH_URL no .env.",
        });
        return;
      }

      const { usuario, senha, ga } = req.body;
      if (!usuario || !senha) {
        res.status(400).json({ error: "Informe usuário e senha" });
        return;
      }

      mkauthSession = await fazerLoginMkauth(
        String(usuario),
        String(senha),
        ga ? String(ga) : "",
      );
      res.status(200).json({ ok: true });
    } catch (error) {
      mkauthSession = null;
      res.status(401).json({
        error: "Falha ao logar no mkauth. Confira usuário e senha.",
        detalhes: String(error),
      });
    }
  };

  repararMkauth = async (req: Request, res: Response) => {
    try {
      if ((req.user?.permission ?? 0) < 5) {
        res.status(403).json({ error: "Permissão insuficiente" });
        return;
      }

      if (!MKAUTH_URL) {
        res.status(500).json({
          error: "Integração mkauth não configurada. Defina MKAUTH_URL no .env.",
        });
        return;
      }

      const cookie = mkauthSession || MKAUTH_COOKIE;
      if (!cookie) {
        res
          .status(401)
          .json({ error: "Faça login no mkauth.", precisaLogin: true });
        return;
      }

      const { logins } = req.body;

      if (!Array.isArray(logins) || logins.length === 0) {
        res.status(400).json({ error: "Informe ao menos um login" });
        return;
      }

      const validos = logins.filter(
        (l: any) => typeof l === "string" && /^[a-zA-Z0-9._-]+$/.test(l),
      );

      if (validos.length === 0) {
        res.status(400).json({ error: "Nenhum login válido" });
        return;
      }

      // O reparar.hhvm aceita vários: login[]=A&login[]=B
      const body = validos
        .map((l: string) => `login[]=${encodeURIComponent(l)}`)
        .join("&");

      const resp = await axios.post(`${MKAUTH_URL}/admin/reparar.hhvm`, body, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Cookie: cookie,
          Origin: MKAUTH_URL,
          Referer: `${MKAUTH_URL}/admin/clientes.hhvm`,
          "User-Agent": "Mozilla/5.0",
        },
        maxRedirects: 0,
        validateStatus: () => true,
        timeout: 30000,
      });

      const corpo = typeof resp.data === "string" ? resp.data : "";
      // 3xx para o login ou corpo com o form de login = sessão expirada.
      if (resp.status >= 300 || /login\.hhvm|executar_login/i.test(corpo)) {
        mkauthSession = null;
        res.status(401).json({
          error: "Sessão do mkauth expirada. Faça login novamente.",
          precisaLogin: true,
        });
        return;
      }

      res.status(200).json({ ok: true, reparados: validos });
    } catch (error: any) {
      res.status(500).json({
        error: "Erro ao reparar no mkauth",
        detalhes: String(error),
      });
    }
  };

  pppoesLogs = async (req: Request, res: Response) => {
    try {
      const resultados: any[] = [];

      for (const servidor of servidores) {
        try {
          const comando = `log print without-paging detail`;
          const resposta = await this.executarSSH(servidor.host!, comando);

          // Regex para os servidores "normais" (data + extra-info)
          const regexNormal =
            /time=(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+topics=([^ ]+)\s+message="([^"]+)"\s+extra-info="([^"]*)"/g;

          // Regex específico para o PPPOE1 (só hora, sem extra-info)
          const regexPPPOE1 =
            /time=(\d{2}:\d{2}:\d{2})\s+topics=([^ ]+)\s+message="([^"]+)"/g;

          // Escolhe qual regex usar
          const regex = servidor.nome === "PPPOE1" ? regexPPPOE1 : regexNormal;

          const matches = [...resposta.matchAll(regex)];

          for (const match of matches) {
            // Se for PPPOE1, não existe "extra"
            if (servidor.nome === "PPPOE1") {
              const [, time, topics, message] = match;

              if (message.startsWith("user api_diversos logged")) continue;

              const hoje = new Date().toISOString().split("T")[0]; // ex: "2025-10-03"
              const dataCompleta = `${hoje} ${time}`;

              resultados.push({
                servidor: servidor.nome,
                time: dataCompleta,
                topics,
                message,
                extra: null, // mantém consistência no JSON
              });
            } else {
              const [, time, topics, message, extra] = match;

              if (message.startsWith("user api_diversos logged")) continue;

              resultados.push({
                servidor: servidor.nome,
                time,
                topics,
                message,
                extra,
              });
            }
          }
        } catch (err: any) {
          resultados.push({
            servidor: servidor.nome,
            erro: err.message || "Erro desconhecido",
          });
        }
      }

      res.status(200).json(resultados);
    } catch (error) {
      res.status(500).json(error);
    }
  };

  desconections = async (req: Request, res: Response) => {
    try {
      const { pppoe } = req.body;
      const ClientesRepository = MkauthSource.getRepository(Radacct);
      const Desconexoes = await ClientesRepository.find({
        where: { username: pppoe },
        order: { radacctid: "DESC" },
        take: 8,
      });
      res.status(200).json({ desconexoes: Desconexoes });
      return;
    } catch (error) {
      ////console.log(error);
    }
  };

  normalizeMac(mac: string): string {
    return mac
      .toUpperCase() // maiúsculas
      .replace(/[^0-9A-F]/g, ""); // remove tudo que não seja HEX
  }

  onuSinal = async (req: Request, res: Response) => {
    try {
      const { pppoe } = req.body;

      const ClientesRepository = MkauthSource.getRepository(ClientesEntities);
      let User = await ClientesRepository.findOne({
        where: { login: pppoe, cli_ativado: "s" },
        order: { id: "ASC" },
      });

      const ip = String(process.env.OLT_IP);
      const login = String(process.env.OLT_LOGIN);
      const password = String(process.env.OLT_PASSWORD);

      let buffer = "";

      const conn = new Telnet();

      // 🟡 Eventos para log no terminal
      conn.removeAllListeners("data");
      conn.on("data", async (data) => {
        const chunk = data.toString();
        buffer += chunk;
        console.log(chunk);

        // se a OLT pedir "Press any key", manda Enter
        if (chunk.includes("Press any key")) {
          await conn?.send("\n").catch(console.error);
        }
      });

      const params = {
        host: ip,
        port: 23,
        timeout: 10000,
        sendTimeout: 2000,
        debug: true,
        shellPrompt: /Admin\\onu#\s*$/,
        stripShellPrompt: true,
        negotiationMandatory: false,
        disableLogon: true,
      };

      await conn.connect(params);

      await conn.send(login);

      await conn.send(password);

      await conn.send("en");
      await conn.send(password);

      const slot = User?.porta_olt?.substring(0, 2);
      const pon = User?.porta_olt?.substring(2, 4);
      const rawTag = User?.tags ?? "";
      const snCliente = this.normalizeMac(rawTag.trim());

      let onuId: any;

      if (!snCliente) {
        ////console.log("Procurando ONU com MAC normalizado:", snCliente);
        res.status(500).json({ respostaTelnet: "Sem Onu" });
        return;
      }

      await conn.exec("cd onu", { execTimeout: 30000 });

      const query = await conn.exec(`show online slot ${slot} pon ${pon}`, {
        execTimeout: 30000,
        stripControls: true, // remove caracteres de controle
      });

      // divide a saída em linhas
      const lines = query.split("\n");

      // limpa as mensagens "Press any key..." e espaços extras
      const cleaned = lines
        .map(
          (l) => l.replace(/--Press any key.*?stop--/g, "").trim(), // remove a mensagem
        )
        .filter((l) => /^\d+/.test(l)); // mantém só linhas que começam com número (as ONUs)

      // agora converte em objetos
      const onus = cleaned.map((line) => {
        const parts = line.trim().split(/\s+/);

        return {
          onuid: parts[0] ?? "", // ID da ONU
          model: parts[1] ?? "", // Modelo (pode vir vazio)
          sn: parts[2] ?? "", // Número de série ou MAC
          extra: parts[3] ?? "", // Às vezes vem "epon,123456"
          slotPon: parts[parts.length - 1], // sempre no final
        };
      });

      // console.log("DEBUG linhas limpas:", onus);

      onuId = onus.find((f) => this.normalizeMac(f.sn) === snCliente)?.onuid;

      if (!onuId || !slot || !pon) {
        await conn.end();
        res.status(500).json({ respostaTelnet: "Sem Onu" });
        return;
      }

      console.log("Numero onu " + onuId);

      const optic = await conn.exec(
        `show optic_module slot ${slot} pon ${pon} onu ${onuId}`,
        { execTimeout: 30000 },
      );

      await new Promise((resolve) => setTimeout(resolve, 1500));

      const output = optic.split("Admin\\onu#")[0].trim();

      console.log(output + "outpte");

      if (/onu#\s*$/i.test(output)) {
        await conn.end();
        res.status(500).json({ respostaTelnet: "ONU APAGADA" });
        return;
      }

      this.onuId = onuId;

      ////console.log(output);

      if (!onuId || !output) {
        res.status(500).json({ respostaTelnet: "Sem Onu" });
        return;
      }

      res.status(200).json({ respostaTelnet: output });
      await conn.end();
    } catch (error) {
      console.error("❌ Erro Telnet:", error);
      res.status(500).json({
        respostaTelnet: "Falha ao executar comando Telnet",
        detalhes: String(error),
      });
    }
  };

  onuReiniciar = async (req: Request, res: Response) => {
    let turnOff = "";

    try {
      const { pppoe } = req.body;

      const ClientesRepository = MkauthSource.getRepository(ClientesEntities);
      let User = await ClientesRepository.findOne({
        where: { login: pppoe, cli_ativado: "s" },
        order: { id: "ASC" },
      });

      const ip = String(process.env.OLT_IP);
      const login = String(process.env.OLT_LOGIN);
      const password = String(process.env.OLT_PASSWORD);

      const conn = new Telnet();

      // 🟡 Eventos para log no terminal
      conn.on("data", (data) => {
        buffer = data.toString();
        console.log(buffer);
      });

      let buffer = "";

      const params = {
        host: ip,
        port: 23,
        timeout: 10000,
        sendTimeout: 200,
        debug: true,
        shellPrompt: /[#>]\s*$/,
        stripShellPrompt: true,
        negotiationMandatory: false,
        disableLogon: true,
      };

      await conn.connect(params);

      await conn.send(login);

      await conn.send(password);

      await conn.send("en");
      await conn.send(password);
      await conn.send("cd onu");

      const slot = User?.porta_olt?.substring(0, 2);
      const pon = User?.porta_olt?.substring(2, 4);
      const rawTag = User?.tags ?? "";
      const snCliente = this.normalizeMac(rawTag.trim());

      let onuId = "";

      if (snCliente) {
        ////console.log("Procurando ONU com MAC normalizado:", snCliente);
        onuId = await this.buscarOnuIdPorMac(
          conn,
          `show online slot ${slot} pon ${pon}`,
          snCliente,
        );
      }

      ////console.log(this.onuId);

      await new Promise((resolve) => setTimeout(resolve, 1500));

      if (!onuId || !slot || !pon) {
        await conn.end();
        res.status(500).json({ respostaTelnet: "Sem Onu" });
        return;
      }

      await conn.send(`cd ..`);

      await conn.send(`cd maintenance`);

      turnOff = await conn.exec(
        `reboot slot ${slot} pon ${pon} onulist ${onuId}`,
        { timeout: 1000 },
      );

      console.log("Turn off " + turnOff);

      if (turnOff === "reset onu ok!") {
        res.status(200).json({
          respostaTelnet: "ONU reiniciada com sucesso: " + turnOff,
        });
        return;
      }

      res.status(200).json({
        respostaTelnet: "ONU reiniciada com sucesso: " + turnOff,
      });
    } catch (error: any) {
      res.status(500).json({ error: "Erro ao reiniciar ONU" });
    }
  };

  executarSSH = async (host: string, comando: string): Promise<string> => {
    try {
      return new Promise((resolve, reject) => {
        const conn = new Client();
        let output = "";

        // ////console.log(`[DEBUG] Tentando conectar no host: ${host}`);

        conn
          .on("ready", () => {
            // ////console.log(`[DEBUG] Conectado com sucesso no ${host}`);
            conn.exec(comando, (err, stream) => {
              if (err) {
                console.error(
                  `[ERRO] Erro ao executar comando no ${host}:`,
                  err,
                );
                conn.end();
                return reject(err);
              }

              stream
                .on("close", (code: number, signal: string) => {
                  console
                    .log
                    // `[DEBUG] Conexão fechada - Código: ${code}, Sinal: ${signal}`
                    ();
                  conn.end();
                  resolve(output);
                })
                .on("data", (data: Buffer) => {
                  // console.log(`[DEBUG] STDOUT (${host}):\n${data.toString()}`);
                  output += data.toString();
                })
                .stderr.on("data", (data: Buffer) => {
                  console
                    .error
                    // `[DEBUG] STDERR (${host}):\n${data.toString()}`
                    ();
                  output += data.toString();
                });
            });
          })
          .on("error", (err) => {
            console.error(`[ERRO] Erro de conexão com ${host}:`, err);
            reject(err);
          })
          .connect({
            host,
            port: 2004,
            username: process.env.MIKROTIK_LOGIN!,
            password: process.env.MIKROTIK_PASSWORD!,
            readyTimeout: 5000,
          });
      });
    } catch (error) {
      //console.log(error);
      return "";
    }
  };

  async buscarOnuIdPorMac(
    conn: Telnet,
    comando: string,
    snClienteRaw: string,
  ): Promise<string> {
    try {
      const snCliente = this.normalizeMac(snClienteRaw);
      return await new Promise<string>(async (resolve, reject) => {
        let buffer = "";
        const processadas = new Set<string>();
        let encontrou = false;

        const onData = (data: Buffer) => {
          if (encontrou) return;

          const texto = data.toString();
          buffer += texto;

          const linhas = texto
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);

          for (const linha of linhas) {
            if (processadas.has(linha)) continue;
            processadas.add(linha);

            const partes = linha.split(/\s+/);
            if (partes.length < 3) continue;

            const id = partes[0];
            let snRaw = partes[2];
            const sn = this.normalizeMac(snRaw);

            if (!/^\d+$/.test(id)) continue; // ignora cabeçalhos ou mensagens de sistema

            if (sn === snCliente) {
              encontrou = true;
              this.onuId = id;
              conn.removeListener("data", onData);
              conn.send("\x03");
              return resolve(this.onuId);
            }
          }

          if (!encontrou && buffer.includes("Press any key")) {
            buffer = "";
            conn.send("\n");
          } else if (!encontrou && buffer.includes("Admin\\onu#")) {
            conn.removeListener("data", onData);
            resolve("");
          }
        };

        try {
          conn.on("data", onData);
          await conn.send(comando);
        } catch (e) {
          conn.removeListener("data", onData);
          reject(e);
        }
      });
    } catch (error) {
      //console.log(error);
      return "";
    }
  }

  mikrotik = async (req: Request, res: Response) => {
    try {
      const testes = {
        ping: "",
        fr: "",
        velocidade: "",
      };

      const { pppoe } = req.body;
      const ClientesRepository = MkauthSource.getRepository(ClientesEntities);
      const User = await ClientesRepository.findOne({
        where: { login: pppoe, cli_ativado: "s" },
        order: { id: "ASC" },
      });

      if (!User) {
        res.status(404).json({ erro: "Usuário não encontrado ou sem IP." });
        return;
      }

      let ipCliente = "";
      const resultados = [];

      for (const servidor of servidores) {
        try {
          //console.log("VERIFICANDO PPPoE ATIVO NO SERVIDOR:", servidor.nome);

          const comando = `/ppp active print where name="${pppoe}"`;
          const resposta = await this.executarSSH(servidor.host!, comando);

          // Verifica se há linha com "pppoe" e "address=" (ou IP no formato comum)
          const ativo = /pppoe\s+\S+\s+([0-9]{1,3}\.){3}[0-9]{1,3}/.test(
            resposta,
          );

          resultados.push({
            servidor: servidor.nome,
            encontrado: ativo,
            host: servidor.host,
            resposta,
          });

          if (ativo) {
            const comando = `/ppp active print without-paging detail where name=${pppoe}`;
            const resposta = await this.executarSSH(servidor.host!, comando);

            const regex =
              /name="([^"]+)"\s+service=pppoe\s+caller-id="([0-9A-F:]+)"\s+address=([\d.]+)\s+uptime=([\dhms]+)/i;

            const match = regex.exec(resposta);

            if (match) {
              const nome = match[1];
              const callerId = match[2];
              const ipCliente = match[3]; // 🎯 aqui está o IP do cliente
              const uptime = match[4];

              console.log({ nome, callerId, ipCliente, uptime });
            }
            break;
          }
        } catch (err: any) {
          resultados.push({
            servidor: servidor.nome,
            erro: err.message || "Erro desconhecido",
          });
        }
      }

      const primeiro = resultados.find((r) => r.encontrado);

      if (!primeiro || !primeiro.host) {
        res.status(500).json();
      }

      if (primeiro && primeiro.host) {
        this.clientIp = ipCliente;
        const ipDoServidor = primeiro.host;
        this.serverIp = ipDoServidor;

        //console.log("VERSAO");
        const versaoMikrotik = `/system resource print`;

        const respostaversaoMikrotik = await this.executarSSH(
          this.serverIp,
          versaoMikrotik,
        );

        let versao = "";
        const lines = respostaversaoMikrotik.split("\n");

        for (const linha of lines) {
          if (linha.toLowerCase().includes("version:")) {
            versao = linha.split(":")[1].trim();
            break;
          }
        }

        this.versao = versao;
        this.versao = parseInt(this.versao.split(".")[0]);

        let conectado = false;

        const conectadoComand = `/ppp active print where address="${ipCliente}"`;

        const conectadoResposta = await this.executarSSH(
          ipDoServidor,
          conectadoComand,
        );

        if (this.versao >= 7) {
          if (conectadoResposta.includes(ipCliente)) {
            conectado = true;
          }
        } else if (this.versao <= 6) {
          if (conectadoResposta.includes(ipCliente)) {
            conectado = true;
          }
        }

        //console.log(versao);

        //console.log("PING IP");
        const outroComando = `/ping ${ipCliente} count=1`;
        const respostaPing = await this.executarSSH(ipDoServidor, outroComando);

        const linhaPing = respostaPing
          .split("\n")
          .find((linha) => linha.trim().startsWith("0"));

        if (linhaPing) {
          const partes = linhaPing.trim().split(/\s+/); // separa por espaços múltiplos

          const size = partes[2]; // coluna SIZE
          const ttl = partes[3]; // coluna TTL
          const time = partes[4]; // coluna TIME

          testes.ping = `SIZE ${size} / TTL ${ttl} / TIME ${time}`;
        }

        //console.log("FRAGMENT");
        const comandoFragment = `/ping address=${ipCliente} size=1492 do-not-fragment count=1`;

        const respostaFragment = await this.executarSSH(
          ipDoServidor,
          comandoFragment,
        );

        //console.log(respostaFragment);

        let statusFragment = "";
        const linhas = respostaFragment.trim().split("\n").reverse();

        for (const linha of linhas) {
          const partes = linha.trim().split(/\s{2,}|\t+/);

          if (
            linha.toLowerCase().includes("fragmentation") ||
            linha.toLowerCase().includes("packet too large")
          ) {
            statusFragment = partes.slice(1).join(" ");
            break;
          }
        }

        if (!statusFragment || statusFragment.trim() === "") {
          testes.fr = "Sem Fragmentação";
        } else {
          testes.fr = statusFragment;
        }

        let comandoBuffer = "";

        if (this.versao <= 6) {
          comandoBuffer = `ping address=${ipCliente} interval=0.01 size=30000 count=500`;
        } else if (this.versao >= 7) {
          comandoBuffer = `/tool ping ${ipCliente} size=30000 interval=0.01 count=500`;
        }

        //console.log("BUFFER");
        const respostaBuffer = await this.executarSSH(
          ipDoServidor,
          comandoBuffer,
        );

        // //console.log(respostaBuffer);

        const comandoVelocidade = `/interface monitor-traffic <pppoe-${pppoe}> duration=1`;

        const respostaVelocidade = await this.executarSSH(
          ipDoServidor,
          comandoVelocidade,
        );

        const linhasVelocidade = respostaVelocidade.split("\n");

        let rx = "";
        let tx = "";

        for (const linha of linhasVelocidade) {
          const l = linha.trim();

          if (l.startsWith("rx-bits-per-second:")) {
            rx = l.split(":")[1].trim(); // ex: "49.7kbps"
          }

          if (l.startsWith("tx-bits-per-second:")) {
            tx = l.split(":")[1].trim(); // ex: "4.8Mbps"
          }
        }

        testes.velocidade = `⬇️ ${tx} / ⬆️ ${rx}`;

        res.status(200).json({
          tests: testes,
          conectado: conectado,
        });
        return;
      }
    } catch (error) {
      console.error("Erro geral:", error);
      res.status(500).json({ erro: "Erro interno." });
    }
  };

  mikrotikTempoReal = async (req: Request, res: Response) => {
    try {
      const { pppoe } = req.body;
      const tempoReal = {
        tmp_tx: 0,
        tmp_rx: 0,
      };

      if (this.serverIp) {
        ("TEMPO REAL");
        const comandoVelocidade = `/interface monitor-traffic <pppoe-${pppoe}> duration=5`;

        const respostaVelocidade = await this.executarSSH(
          this.serverIp,
          comandoVelocidade,
        );

        const linhasVelocidade = respostaVelocidade.split("\n");

        let rx = "";
        let tx = "";

        for (const linha of linhasVelocidade) {
          const l = linha.trim();

          if (l.startsWith("rx-bits-per-second:")) {
            rx = l.split(":")[1].trim(); // ex: "49.7kbps"
          }

          if (l.startsWith("tx-bits-per-second:")) {
            tx = l.split(":")[1].trim(); // ex: "4.8Mbps"
          }
        }

        tempoReal.tmp_tx = this.parseBitsPerSecond(tx);
        tempoReal.tmp_rx = this.parseBitsPerSecond(rx);

        if (
          typeof tempoReal.tmp_tx !== "number" &&
          typeof tempoReal.tmp_rx !== "number"
        ) {
          res.status(500).json();
        }

        res.status(200).json({ tmp: tempoReal });
      } else {
        res.status(500).json({ erro: "Erro interno." });
      }
    } catch (error) {
      console.error("Erro geral:", error);
      res.status(500).json({ erro: "Erro interno. " + error });
    }
  };

  parseBitsPerSecond(valor: string): number {
    if (!valor) return 0;

    const match = valor.toLowerCase().match(/([\d.]+)\s*(kbps|mbps|bps)/);
    if (!match) return 0;

    const num = parseFloat(match[1]);
    const unidade = match[2];

    switch (unidade) {
      case "mbps":
        return num;
      case "kbps":
        return num / 1000;
      case "bps":
        return num / 1_000_000;
      default:
        return 0;
    }
  }
}

export default new ClientAnalytics();
