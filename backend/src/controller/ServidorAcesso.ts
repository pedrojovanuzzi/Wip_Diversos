import { Request, Response } from "express";
import { Client } from "ssh2";
import AppDataSource from "../database/DataSource";
import { Telnet } from "telnet-client";
import {
  FuncaoServidor,
  ProtocoloServidor,
  ServidorAcesso,
  TipoServidor,
} from "../entities/ServidorAcesso";
import { cifrarSenha, decifrarSenha } from "../services/servidorAcesso.service";

const TIPOS: TipoServidor[] = ["mikrotik", "huawei"];
const FUNCOES: FuncaoServidor[] = ["pppoe", "olt"];
const PROTOCOLOS: ProtocoloServidor[] = ["ssh", "telnet"];

/** Porta usual de cada fabricante quando o cadastro não informa. */
const PORTA_PADRAO: Record<TipoServidor, number> = {
  mikrotik: 2004,
  huawei: 22,
};

/** A senha nunca volta pela API — a tela só informa se já existe uma. */
function semSenha(s: ServidorAcesso) {
  const { senha, ...resto } = s;
  return { ...resto, tem_senha: !!senha };
}

class ServidorAcessoController {
  private repo = () => AppDataSource.getRepository(ServidorAcesso);

  public listar = async (req: Request, res: Response) => {
    try {
      const { tipo } = req.query;
      const where =
        tipo && TIPOS.includes(String(tipo) as TipoServidor)
          ? { tipo: String(tipo) as TipoServidor }
          : {};
      const servidores = await this.repo().find({
        where,
        order: { tipo: "ASC", ordem: "ASC", id: "ASC" },
      });
      res.status(200).json(servidores.map(semSenha));
    } catch (error) {
      console.error("[ServidorAcesso.listar]", error);
      res.status(500).json({ message: "Erro ao listar servidores." });
    }
  };

  public criar = async (req: Request, res: Response) => {
    try {
      const dados = this.validar(req, res, true);
      if (!dados) return;

      const servidor = await this.repo().save({
        ...dados,
        senha: cifrarSenha(String(req.body.senha)),
      });
      res.status(201).json(semSenha(servidor as ServidorAcesso));
    } catch (error) {
      console.error("[ServidorAcesso.criar]", error);
      res.status(500).json({ message: "Erro ao cadastrar servidor." });
    }
  };

  public atualizar = async (req: Request, res: Response) => {
    try {
      const servidor = await this.repo().findOne({
        where: { id: Number(req.params.id) },
      });
      if (!servidor) {
        res.status(404).json({ message: "Servidor não encontrado." });
        return;
      }

      const dados = this.validar(req, res, false);
      if (!dados) return;

      Object.assign(servidor, dados);
      // Campo em branco na edição significa "mantém a senha atual".
      if (String(req.body.senha ?? "").trim()) {
        servidor.senha = cifrarSenha(String(req.body.senha));
      }

      await this.repo().save(servidor);
      res.status(200).json(semSenha(servidor));
    } catch (error) {
      console.error("[ServidorAcesso.atualizar]", error);
      res.status(500).json({ message: "Erro ao atualizar servidor." });
    }
  };

  public remover = async (req: Request, res: Response) => {
    try {
      const resultado = await this.repo().delete({
        id: Number(req.params.id),
      });
      if (!resultado.affected) {
        res.status(404).json({ message: "Servidor não encontrado." });
        return;
      }
      res.status(200).json({ message: "Servidor removido." });
    } catch (error) {
      console.error("[ServidorAcesso.remover]", error);
      res.status(500).json({ message: "Erro ao remover servidor." });
    }
  };

  /**
   * GET /exportar — backup em JSON.
   *
   * A senha vai como está no banco, cifrada. Isso evita um arquivo com
   * credenciais legíveis e permite restaurar no mesmo ambiente; em outro
   * servidor, com outra chave, basta redigitar a senha depois.
   */
  public exportar = async (_req: Request, res: Response) => {
    try {
      const servidores = await this.repo().find({
        order: { tipo: "ASC", ordem: "ASC", id: "ASC" },
      });

      res.status(200).json({
        versao: 1,
        exportado_em: new Date().toISOString(),
        servidores: servidores.map((s) => ({
          nome: s.nome,
          tipo: s.tipo,
          funcao: s.funcao,
          protocolo: s.protocolo,
          host: s.host,
          porta: s.porta,
          login: s.login,
          senha: s.senha,
          ativo: s.ativo,
          ordem: s.ordem,
          comando_clientes: s.comando_clientes ?? null,
          observacao: s.observacao ?? null,
        })),
      });
    } catch (error) {
      console.error("[ServidorAcesso.exportar]", error);
      res.status(500).json({ message: "Erro ao exportar servidores." });
    }
  };

  /**
   * POST /importar { servidores, substituir? }
   * Restaura o backup. Casa pelo nome: atualiza o que existe e cria o resto.
   */
  public importar = async (req: Request, res: Response) => {
    try {
      const lista = req.body?.servidores;
      if (!Array.isArray(lista) || lista.length === 0) {
        res
          .status(400)
          .json({ message: "Arquivo sem servidores para restaurar." });
        return;
      }

      const repo = this.repo();
      const existentes = await repo.find();
      const porNome = new Map(existentes.map((s) => [s.nome.toUpperCase(), s]));

      let criados = 0;
      let atualizados = 0;
      const ignorados: string[] = [];

      for (const bruto of lista) {
        const nome = String(bruto?.nome ?? "").trim();
        const tipo = String(bruto?.tipo ?? "").trim() as TipoServidor;
        const host = String(bruto?.host ?? "").trim();
        const login = String(bruto?.login ?? "").trim();
        const senha = String(bruto?.senha ?? "");

        if (!nome || !host || !login || !TIPOS.includes(tipo) || !senha) {
          ignorados.push(nome || "(sem nome)");
          continue;
        }

        const funcaoBruta = String(bruto?.funcao ?? "").trim() as FuncaoServidor;
        const dados = {
          nome,
          tipo,
          funcao:
            tipo === "mikrotik"
              ? ("pppoe" as FuncaoServidor)
              : FUNCOES.includes(funcaoBruta)
                ? funcaoBruta
                : ("pppoe" as FuncaoServidor),
          protocolo: PROTOCOLOS.includes(
            String(bruto?.protocolo ?? "").trim() as ProtocoloServidor,
          )
            ? (String(bruto.protocolo).trim() as ProtocoloServidor)
            : ("ssh" as ProtocoloServidor),
          host,
          porta: Number(bruto?.porta) || PORTA_PADRAO[tipo],
          login,
          // Backup traz a senha já cifrada; digitada à mão, cifra agora.
          senha: senha.startsWith("enc:v1:") ? senha : cifrarSenha(senha),
          ativo: bruto?.ativo === undefined ? true : !!bruto.ativo,
          ordem: Number(bruto?.ordem) || 0,
          comando_clientes: bruto?.comando_clientes
            ? String(bruto.comando_clientes).slice(0, 255)
            : null,
          observacao: bruto?.observacao
            ? String(bruto.observacao).slice(0, 255)
            : null,
        };

        const atual = porNome.get(nome.toUpperCase());
        if (atual) {
          Object.assign(atual, dados);
          await repo.save(atual);
          atualizados += 1;
        } else {
          await repo.save(repo.create(dados));
          criados += 1;
        }
      }

      res.status(200).json({ criados, atualizados, ignorados });
    } catch (error) {
      console.error("[ServidorAcesso.importar]", error);
      res.status(500).json({ message: "Erro ao restaurar servidores." });
    }
  };

  /** Abre a conexão e devolve o erro do equipamento, se houver. */
  public testar = async (req: Request, res: Response) => {
    try {
      const servidor = await this.repo().findOne({
        where: { id: Number(req.params.id) },
      });
      if (!servidor) {
        res.status(404).json({ message: "Servidor não encontrado." });
        return;
      }

      const senha = decifrarSenha(servidor.senha);
      if (servidor.protocolo === "telnet") {
        await this.testarTelnet(servidor);
      } else {
        await this.testarSsh(servidor, senha);
      }

      res.status(200).json({ ok: true, message: "Conexão estabelecida." });
    } catch (error: any) {
      res.status(200).json({
        ok: false,
        message: error?.message || "Não foi possível conectar.",
      });
    }
  };

  private testarSsh(servidor: ServidorAcesso, senha: string) {
    return new Promise<void>((resolve, reject) => {
      const conn = new Client();
      const encerrar = (erro?: Error) => {
        conn.end();
        erro ? reject(erro) : resolve();
      };
      conn
        .on("ready", () => encerrar())
        .on("error", (err) => encerrar(err))
        .connect({
          host: servidor.host,
          port: servidor.porta,
          username: servidor.login,
          password: senha,
          readyTimeout: 8000,
        });
    });
  }

  /** No Telnet o login é conversado no shell; aqui só a porta é checada. */
  private async testarTelnet(servidor: ServidorAcesso) {
    const conn = new Telnet();
    try {
      await conn.connect({
        host: servidor.host,
        port: servidor.porta,
        timeout: 8000,
        negotiationMandatory: false,
      } as any);
    } finally {
      await conn.end().catch(() => undefined);
    }
  }

  /** Campos comuns de criação e edição; responde 400 e devolve null se inválido. */
  private validar(req: Request, res: Response, exigeSenha: boolean) {
    const nome = String(req.body?.nome ?? "").trim();
    const tipo = String(req.body?.tipo ?? "").trim() as TipoServidor;
    const host = String(req.body?.host ?? "").trim();
    const login = String(req.body?.login ?? "").trim();
    // Mikrotik só faz PPPoE aqui; no Huawei o papel muda os comandos.
    const funcaoBruta = String(req.body?.funcao ?? "").trim() as FuncaoServidor;
    const funcao: FuncaoServidor = FUNCOES.includes(funcaoBruta)
      ? funcaoBruta
      : "pppoe";
    const protocoloBruto = String(
      req.body?.protocolo ?? "",
    ).trim() as ProtocoloServidor;
    const protocolo: ProtocoloServidor = PROTOCOLOS.includes(protocoloBruto)
      ? protocoloBruto
      : "ssh";

    if (!nome || !host || !login) {
      res.status(400).json({ message: "Informe nome, host e login." });
      return null;
    }
    if (!TIPOS.includes(tipo)) {
      res.status(400).json({ message: "Tipo deve ser mikrotik ou huawei." });
      return null;
    }
    if (exigeSenha && !String(req.body?.senha ?? "").trim()) {
      res.status(400).json({ message: "Informe a senha de acesso." });
      return null;
    }

    const portaBruta = Number(req.body?.porta);
    const porta =
      Number.isFinite(portaBruta) && portaBruta > 0 && portaBruta <= 65535
        ? Math.trunc(portaBruta)
        : PORTA_PADRAO[tipo];

    return {
      nome,
      tipo,
      funcao: tipo === "mikrotik" ? "pppoe" : funcao,
      protocolo: tipo === "mikrotik" ? "ssh" : protocolo,
      host,
      porta,
      login,
      ativo: req.body?.ativo === undefined ? true : !!req.body.ativo,
      ordem: Number.isFinite(Number(req.body?.ordem))
        ? Number(req.body.ordem)
        : 0,
      comando_clientes: req.body?.comando_clientes
        ? String(req.body.comando_clientes).slice(0, 255)
        : null,
      observacao: req.body?.observacao
        ? String(req.body.observacao).slice(0, 255)
        : null,
    };
  }
}

export default new ServidorAcessoController();
