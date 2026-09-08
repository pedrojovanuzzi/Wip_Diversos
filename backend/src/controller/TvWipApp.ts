import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import dotenv from "dotenv";

import TvWipService from "../services/TvWipService";
import TvWipCanaisService, {
  CanalResolvido,
} from "../services/TvWipCanaisService";
import TvWipEpgService from "../services/TvWipEpgService";

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

/**
 * Nome do canal como está no cadastro, já limpo.
 *
 * Devolve vazio quando não há nome utilizável — inclusive quando o campo tem
 * só dígitos, que é o cadastro antigo repetindo o número do stream. Nos dois
 * casos o aplicativo não tem o que escrever no card.
 */
function nomeDoCadastro(canal: CanalResolvido): string {
  const limpo = String(canal.canal ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return /^[0-9]+$/.test(limpo) ? "" : limpo;
}

/**
 * Nome de cada canal, pronto para a tela.
 *
 * O cadastro antigo tem canal sem nome, e era isso que chegava ao aplicativo
 * como um `#EXTINF` terminando na vírgula: sem texto ali, o app caía no último
 * pedaço da URL — o número do stream do XUI. Era o "canal 35, canal 41" na
 * grade.
 *
 * Quando o cadastro não ajuda, o nome vem de quem realmente sabe: o servidor
 * que entrega o canal. A consulta é a mesma do painel e fica em cache por
 * servidor, então isto custa uma requisição, não uma por canal. Se nem o XUI
 * responder, sobra `Canal <id>` — feio, mas identifica.
 */
async function nomesDosCanais(
  canais: CanalResolvido[],
): Promise<Map<number, string>> {
  const nomes = new Map<number, string>();
  const semNome: CanalResolvido[] = [];

  for (const canal of canais) {
    const doCadastro = nomeDoCadastro(canal);
    if (doCadastro) nomes.set(canal.idcanal, doCadastro);
    else semNome.push(canal);
  }

  // Em sequência de propósito: o primeiro busca a listagem do servidor e os
  // demais aproveitam o cache dela.
  for (const canal of semNome) {
    const doXui = await TvWipEpgService.nomeNoXui(canal.url);
    nomes.set(canal.idcanal, doXui || `Canal ${canal.idcanal}`);
  }

  return nomes;
}

/** Junta o que o app precisa de um canal, com a logo já em HTTPS. */
function paraApp(canal: CanalResolvido, origem: string, nome: string) {
  const arquivo = String(canal.imagens || "").split("/").pop() || "";
  return {
    id: canal.idcanal,
    nome,
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
      const nomes = await nomesDosCanais(canais);

      res.json({
        ok: true,
        token,
        validade: VALIDADE,
        cliente: {
          login: resultado.conta.login,
          nome: resultado.conta.nome,
        },
        total: canais.length,
        canais: canais.map((c) => paraApp(c, origem, nomes.get(c.idcanal) || `Canal ${c.idcanal}`)),
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
      const nomes = await nomesDosCanais(canais);

      res.json({
        ok: true,
        login,
        total: canais.length,
        canais: canais.map((c) => paraApp(c, origem, nomes.get(c.idcanal) || `Canal ${c.idcanal}`)),
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
   * Guia de programação dos canais do cliente.
   *
   * Sem `ids`, devolve a grade de todos os canais que ele tem — é o que a
   * tela inicial do aplicativo precisa para mostrar "o que está passando".
   */
  public epg = async (req: Request, res: Response) => {
    try {
      const login = String(res.locals.loginTv);
      const canais = await TvWipCanaisService.canaisDaConta(login);
      const permitidos = new Set(canais.map((c) => c.idcanal));

      const pedidos = String(req.query.ids || "")
        .split(",")
        .map((i) => Number(i.trim()))
        .filter((i) => Number.isFinite(i));

      // Um canal fora do pacote do cliente não entra, nem para consultar a
      // programação: a grade seguiria revelando o que ele não assina.
      const alvos = pedidos.length
        ? pedidos.filter((id) => permitidos.has(id))
        : canais.map((c) => c.idcanal);

      const limite = Math.min(Number(req.query.limite) || 3, 20);
      const grade = await TvWipEpgService.deVarios(alvos, limite);

      res.json({ ok: true, total: grade.length, canais: grade });
    } catch (error: any) {
      console.error("[TvWipApp] Erro no EPG:", error?.message || error);
      res.status(500).json({ ok: false, mensagem: "Erro ao carregar a guia." });
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
      const nomes = await nomesDosCanais(canais);

      const linhas = ["#EXTM3U"];
      for (const c of canais) {
        const item = paraApp(c, origem, nomes.get(c.idcanal) || `Canal ${c.idcanal}`);
        // As aspas delimitam o atributo: se sobrar uma no nome, o resto da
        // linha é lido errado. `tvg-name` é redundante de propósito — é por
        // onde os players (o nosso inclusive) recuperam o nome quando o texto
        // depois da vírgula não serve.
        const nome = item.nome.replace(/"/g, "'");
        linhas.push(
          `#EXTINF:-1 tvg-id="${item.id}" tvg-name="${nome}"` +
            (item.logo ? ` tvg-logo="${item.logo}"` : "") +
            ` group-title="TV WIP",${nome}`,
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
