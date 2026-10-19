import { Request, Response } from "express";
import {
  extrairDominios,
  inserirDominios,
  listarDominios,
  removerDominios,
} from "../utils/createDns";
import path from "path";
import { execFile } from "child_process";
import { Client } from "ssh2";
import AppDataSource from "../database/DataSource";
import { PowerDnsConfig } from "../entities/PowerDnsConfig";
import {
  cifrarSenha,
  decifrarSenha,
} from "../services/servidorAcesso.service";

const PATH = path.join(__dirname, "..", "..", "uploads", "DnsPdf.pdf");

// Servidor DNS consultado pelo botão "Testar domínio" enquanto a tela não
// tiver configuração salva (dig @servidor dominio).
const DIG_SERVIDOR_PADRAO =
  process.env.POWERDNS_DIG_SERVER || "143.255.135.34";

// Só letras, números, hífen, underline e pontos: impede que o texto vire opção do dig (+x, -x).
const DOMINIO_VALIDO =
  /^(?=.{1,253}\.?$)([a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9])?)(\.[a-z0-9_]([a-z0-9_-]{0,61}[a-z0-9])?)*\.?$/i;

async function carregarConfig() {
  const [config] = await AppDataSource.getRepository(PowerDnsConfig).find({
    order: { id: "ASC" },
    take: 1,
  });
  return config ?? null;
}

function digLocal(servidorDns: string, alvo: string) {
  return new Promise<string>((resolve, reject) => {
    execFile(
      "dig",
      [`@${servidorDns}`, alvo],
      { timeout: 15000 },
      (error, stdout, stderr) => {
        if (error && !stdout) {
          reject(
            new Error(
              (error as NodeJS.ErrnoException).code === "ENOENT"
                ? "O comando dig não está instalado no servidor."
                : stderr || "Erro ao consultar o DNS.",
            ),
          );
          return;
        }
        resolve(stdout);
      },
    );
  });
}

/**
 * Roda o dig no servidor configurado, por SSH. O comando passa pelo shell
 * remoto, por isso domínio e servidor DNS precisam ter passado no
 * DOMINIO_VALIDO antes de chegar aqui.
 */
function digRemoto(config: PowerDnsConfig, servidorDns: string, alvo: string) {
  return new Promise<string>((resolve, reject) => {
    const conn = new Client();
    let saida = "";
    let erro = "";
    const limite = setTimeout(() => {
      conn.end();
      reject(new Error("Tempo esgotado ao rodar o dig no servidor."));
    }, 20000);

    conn
      .on("ready", () => {
        conn.exec(`dig @${servidorDns} ${alvo}`, (err, stream) => {
          if (err) {
            clearTimeout(limite);
            conn.end();
            reject(err);
            return;
          }
          stream
            .on("data", (d: Buffer) => (saida += d.toString("utf8")))
            .on("close", () => {
              clearTimeout(limite);
              conn.end();
              if (!saida && erro) reject(new Error(erro.trim()));
              else resolve(saida);
            });
          stream.stderr.on("data", (d: Buffer) => (erro += d.toString("utf8")));
        });
      })
      .on("error", (err: Error & { level?: string }) => {
        clearTimeout(limite);
        reject(
          new Error(
            err.level === "client-authentication"
              ? "Login ou senha do servidor recusados."
              : `Não foi possível conectar em ${config.host}: ${err.message}`,
          ),
        );
      })
      .connect({
        host: config.host!,
        port: config.porta,
        username: config.login ?? "",
        password: decifrarSenha(config.senha ?? ""),
        readyTimeout: 8000,
      });
  });
}

class PowerDNS {
  public async inserirPdf(req: Request, res: Response) {
    console.log("📥 Recebida requisição para inserir PDF.");
    await this.processarPdf(req, res, "inserir");
  }

  public async removerPdf(req: Request, res: Response) {
    console.log("📥 Recebida requisição para remover domínios do PDF.");
    await this.processarPdf(req, res, "remover");
  }

  public async inserirDominio(req: Request, res: Response): Promise<void> {
    try {
      const { dominio } = req.body;

      if (!dominio || typeof dominio !== "string") {
        res
          .status(400)
          .json({ error: "O domínio é obrigatório e deve ser um texto." });
        return;
      }

      const dominioAInserir = dominio.toLowerCase().replace(/\.+$/, "") + ".";
      const response = await inserirDominios([dominioAInserir]);

      res.status(200).json({ message: response });
    } catch (error) {
      console.error("Erro ao inserir domínio:", error);
      res.status(500).json({ error: "Erro interno ao inserir o domínio." });
    }
  }

  public async removerDominio(req: Request, res: Response): Promise<void> {
    try {
      const { dominio } = req.body;

      if (!dominio || typeof dominio !== "string") {
        res
          .status(400)
          .json({ error: "O domínio é obrigatório e deve ser um texto." });
        return;
      }

      const dominioARemover = dominio.toLowerCase().replace(/\.+$/, "") + ".";
      const response = await removerDominios([dominioARemover]);

      res.status(200).json({ message: response });
    } catch (error) {
      console.error("Erro ao remover domínio:", error);
      res.status(500).json({ error: "Erro interno ao remover o domínio." });
    }
  }

  /** GET /config — a senha nunca volta; a tela só sabe se já existe uma. */
  public async obterConfig(_req: Request, res: Response): Promise<void> {
    try {
      const config = await carregarConfig();
      res.status(200).json({
        host: config?.host ?? "",
        porta: config?.porta ?? 22,
        login: config?.login ?? "",
        servidor_dns: config?.servidor_dns ?? DIG_SERVIDOR_PADRAO,
        tem_senha: !!config?.senha,
      });
    } catch (error) {
      console.error("Erro ao carregar configuração do DNS:", error);
      res.status(500).json({ error: "Erro ao carregar a configuração." });
    }
  }

  /** PUT /config { host, porta, login, senha, servidor_dns } */
  public async salvarConfig(req: Request, res: Response): Promise<void> {
    try {
      const host = String(req.body?.host ?? "").trim();
      const login = String(req.body?.login ?? "").trim();
      const senha = String(req.body?.senha ?? "");
      const servidorDns = String(req.body?.servidor_dns ?? "").trim();
      const porta = Number(req.body?.porta) || 22;

      // Os dois entram no comando que roda no shell remoto: só nome/IP válido.
      if (!servidorDns || !DOMINIO_VALIDO.test(servidorDns)) {
        res.status(400).json({ error: "Informe um servidor DNS válido." });
        return;
      }
      if (host && !DOMINIO_VALIDO.test(host)) {
        res.status(400).json({ error: "Host do servidor inválido." });
        return;
      }
      if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
        res.status(400).json({ error: "Porta inválida." });
        return;
      }
      if (host && !login) {
        res.status(400).json({ error: "Informe o login do servidor." });
        return;
      }

      const repo = AppDataSource.getRepository(PowerDnsConfig);
      const config = (await carregarConfig()) ?? repo.create();
      config.host = host || null;
      config.porta = porta;
      config.login = login || null;
      config.servidor_dns = servidorDns;
      // Campo em branco significa "mantém a senha atual".
      if (senha.trim()) config.senha = cifrarSenha(senha);
      if (host && !config.senha) {
        res.status(400).json({ error: "Informe a senha de acesso." });
        return;
      }
      await repo.save(config);

      res.status(200).json({ message: "Configuração salva." });
    } catch (error) {
      console.error("Erro ao salvar configuração do DNS:", error);
      res.status(500).json({ error: "Erro ao salvar a configuração." });
    }
  }

  public async testarDominio(req: Request, res: Response): Promise<void> {
    const { dominio } = req.body;
    const alvo = typeof dominio === "string" ? dominio.trim().toLowerCase() : "";

    if (!alvo || !DOMINIO_VALIDO.test(alvo)) {
      res.status(400).json({ error: "Informe um domínio válido." });
      return;
    }

    try {
      const config = await carregarConfig();
      const servidorDns = config?.servidor_dns || DIG_SERVIDOR_PADRAO;

      const saida = config?.host
        ? await digRemoto(config, servidorDns, alvo)
        : await digLocal(servidorDns, alvo);

      const status = saida.match(/status: ([A-Z]+)/)?.[1] ?? "DESCONHECIDO";
      res.status(200).json({
        comando: `dig @${servidorDns} ${alvo}`,
        executado_em: config?.host || "servidor do sistema",
        status,
        saida,
      });
    } catch (error: any) {
      console.error("Erro ao executar dig:", error);
      res
        .status(500)
        .json({ error: error?.message || "Erro ao consultar o DNS." });
    }
  }

  private async processarPdf(
    req: Request,
    res: Response,
    modo: "inserir" | "remover",
  ) {
    try {
      const filePath = req.file?.path;
      if (!filePath) {
        res.status(400).json({ error: "Arquivo não encontrado no upload." });
        return;
      }

      console.log(`📂 Iniciando extração de domínios do arquivo: ${filePath}`);
      const dominiosExtraidos = await extrairDominios(filePath);
      console.log(`🔍 Domínios extraídos: ${dominiosExtraidos.length}`);

      if (dominiosExtraidos.length === 0) {
        console.warn("⚠️ Nenhum domínio encontrado no arquivo.");
        res
          .status(400)
          .json({ error: "Nenhum domínio encontrado no arquivo." });
        return;
      }

      const response =
        modo === "inserir"
          ? await inserirDominios(dominiosExtraidos)
          : await removerDominios(dominiosExtraidos);

      console.log("✅ Processamento concluído com sucesso.");
      res.status(200).json({ message: response });
    } catch (error) {
      console.error("❌ Erro ao transformar arquivo:", error);
      res.status(500).json({ error: "Erro interno ao transformar o arquivo." });
    }
  }

  public async obterDominios(req: Request, res: Response): Promise<void> {
    try {
      const dominios = await listarDominios();
      res.status(200).json({ dominios });
    } catch (error) {
      console.error("Erro ao listar domínios:", error);
      res.status(500).json({ error: "Erro interno ao listar os domínios." });
    }
  }
}

export default PowerDNS;
