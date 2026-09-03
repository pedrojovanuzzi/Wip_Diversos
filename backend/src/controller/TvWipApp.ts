import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import dotenv from "dotenv";

import TvWipService from "../services/TvWipService";
import TvWipCanaisService, {
  CanalResolvido,
} from "../services/TvWipCanaisService";

dotenv.config();

/**
 * API do aplicativo da TV WIP.
 *
 * Fluxo: o app faz login com o mesmo usuário e senha do cadastro, recebe um
 * token e a grade de canais já pronta. Depois pode reconsultar a grade sem
 * pedir a senha de novo.
 *
 * O token NÃO é a palavra final sobre o acesso: toda requisição reconfere se a
 * conta continua ativa. Sem isso, quem tivesse feito login antes de ser
 * desativado continuaria assistindo até o token vencer — e desativar a TV é
 * justamente o motivo deste sistema existir.
 */

/** Validade do token do aplicativo. */
const VALIDADE = "30d";

/** Marca do token, para não confundir com o token do painel interno. */
const ESCOPO = "tv-wip-app";

interface PayloadApp extends JwtPayload {
  login: string;
  escopo: string;
}

/** Junta o que o app precisa de um canal, com a logo já em HTTPS. */
function paraApp(canal: CanalResolvido, origem: string) {
  const arquivo = String(canal.imagens || "").split("/").pop() || "";
  return {
    id: canal.idcanal,
    nome: canal.canal,
    stream: canal.url,
    // A logo passa pelo backend: o servidor de imagens só fala HTTP, e um app
    // em HTTPS (ou com política de rede estrita) recusaria a imagem.
    logo: arquivo
      ? `${origem}/api/tv-wip/logo/${encodeURIComponent(arquivo)}`
      : null,
  };
}

/**
 * Base pública desta API, para montar as URLs das logos.
 *
 * Vale primeiro TVWIP_APP_URL, quando se quer fixar o endereço. Sem ela, o
 * endereço é deduzido da própria requisição — atrás do nginx o protocolo
 * real chega em `x-forwarded-proto`. Não uso a variável `URL` do projeto de
 * propósito: ela aponta para localhost no ambiente de desenvolvimento, e a
 * logo sairia com um endereço que o aparelho do cliente não alcança.
 */
function origemDaRequisicao(req: Request): string {
  const fixa = process.env.TVWIP_APP_URL;
  if (fixa) return String(fixa).replace(/\/$/, "");

  const protocolo = String(req.headers["x-forwarded-proto"] || req.protocol);
  return `${protocolo}://${req.get("host")}`;
}

class TvWipApp {
  /**
   * Login do aplicativo: valida a senha, devolve o token e já manda a grade,
   * para a primeira tela não precisar de uma segunda chamada.
   */
  public login = async (req: Request, res: Response) => {
    try {
      const login = String(req.body?.login ?? req.body?.usuario ?? "");
      const senha = String(req.body?.senha ?? req.body?.password ?? "");

      const resultado = await TvWipService.autenticar(login, senha);

      if (!resultado.permitido || !resultado.conta) {
        // 401 com o motivo no corpo: o app precisa diferenciar senha errada de
        // conta desativada para explicar ao cliente o que fazer.
        res.status(401).json({
          ok: false,
          motivo: resultado.motivo,
          mensagem: resultado.mensagem,
        });
        return;
      }

      const token = jwt.sign(
        { login: resultado.conta.login, escopo: ESCOPO },
        String(process.env.JWT_SECRET),
        { expiresIn: VALIDADE },
      );

      const canais = await TvWipCanaisService.canaisDaConta(
        resultado.conta.login,
      );
      const origem = origemDaRequisicao(req);

      res.json({
        ok: true,
        token,
        validade: VALIDADE,
        cliente: {
          login: resultado.conta.login,
          nome: resultado.conta.nome,
        },
        total: canais.length,
        canais: canais.map((c) => paraApp(c, origem)),
      });
    } catch (error: any) {
      console.error("[TvWipApp] Erro no login:", error?.message || error);
      res.status(500).json({ ok: false, mensagem: "Erro ao entrar." });
    }
  };

  /**
   * Confere o token e, principalmente, se a conta continua valendo.
   *
   * Deixa o login em `res.locals.loginTv` para as rotas seguintes.
   */
  public sessao = async (req: Request, res: Response, next: NextFunction) => {
    const cabecalho = req.headers["authorization"];
    const token =
      (cabecalho && cabecalho.replace(/^Bearer\s+/i, "")) ||
      (req.query.token as string) ||
      "";

    if (!token) {
      res.status(401).json({ ok: false, motivo: "SEM_TOKEN" });
      return;
    }

    try {
      const dados = jwt.verify(
        token,
        String(process.env.JWT_SECRET),
      ) as PayloadApp;

      // Token do painel não vale aqui: os escopos são separados.
      if (dados.escopo !== ESCOPO || !dados.login) {
        res.status(401).json({ ok: false, motivo: "TOKEN_INVALIDO" });
        return;
      }

      // Reconfere a conta a cada chamada: desativar a TV tem que valer na hora.
      const situacao = await TvWipService.situacaoDaConta(dados.login);
      if (!situacao.existe) {
        res.status(401).json({ ok: false, motivo: "NAO_ENCONTRADO" });
        return;
      }
      if (!situacao.ativo) {
        res.status(403).json({
          ok: false,
          motivo: "DESATIVADA",
          mensagem: situacao.motivo
            ? `Acesso desativado: ${situacao.motivo}.`
            : "Acesso desativado.",
        });
        return;
      }

      res.locals.loginTv = dados.login;
      next();
    } catch {
      res.status(401).json({ ok: false, motivo: "TOKEN_EXPIRADO" });
    }
  };

  /** Grade atual do cliente — para o app atualizar sem pedir a senha de novo. */
  public canais = async (req: Request, res: Response) => {
    try {
      const login = String(res.locals.loginTv);
      const canais = await TvWipCanaisService.canaisDaConta(login);
      const origem = origemDaRequisicao(req);

      res.json({
        ok: true,
        login,
        total: canais.length,
        canais: canais.map((c) => paraApp(c, origem)),
      });
    } catch (error: any) {
      console.error("[TvWipApp] Erro ao listar canais:", error?.message || error);
      res.status(500).json({ ok: false, mensagem: "Erro ao carregar canais." });
    }
  };

  /**
   * Só a situação da conta, sem a grade.
   *
   * O app chama de tempos em tempos para saber se ainda pode continuar
   * assistindo — é mais leve que baixar a lista inteira.
   */
  public perfil = async (_req: Request, res: Response) => {
    try {
      const login = String(res.locals.loginTv);
      const situacao = await TvWipService.situacaoDaConta(login);
      res.json({
        ok: true,
        login,
        ativo: situacao.ativo,
        nome: situacao.nome,
        avulso: situacao.avulso,
      });
    } catch (error: any) {
      console.error("[TvWipApp] Erro no perfil:", error?.message || error);
      res.status(500).json({ ok: false, mensagem: "Erro ao consultar." });
    }
  };

  /**
   * Playlist M3U com os canais do cliente, para players que já leem esse
   * formato (VLC, Tivimate e afins) sem precisar entender a nossa API.
   */
  public playlist = async (req: Request, res: Response) => {
    try {
      const login = String(res.locals.loginTv);
      const canais = await TvWipCanaisService.canaisDaConta(login);
      const origem = origemDaRequisicao(req);

      const linhas = ["#EXTM3U"];
      for (const c of canais) {
        const item = paraApp(c, origem);
        linhas.push(
          `#EXTINF:-1 tvg-id="${item.id}"` +
            (item.logo ? ` tvg-logo="${item.logo}"` : "") +
            ` group-title="TV WIP",${item.nome}`,
        );
        linhas.push(item.stream);
      }

      res.setHeader("Content-Type", "audio/x-mpegurl; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="tvwip.m3u"',
      );
      res.send(linhas.join("\n"));
    } catch (error: any) {
      console.error("[TvWipApp] Erro na playlist:", error?.message || error);
      res.status(500).send("Erro ao montar a playlist.");
    }
  };
}

export default new TvWipApp();
