import axios from "axios";

import CanaisSource from "../database/CanaisSource";
import { Canal } from "../entities/Canal";

/**
 * Guia de programação (EPG) dos canais que vêm de um servidor XUI.
 *
 * As credenciais não ficam em lugar nenhum do nosso lado: a própria URL do
 * canal já traz usuário, senha e o id do stream
 * (`https://servidor/usuario/senha/126.m3u8`). Isso também resolve o caso de
 * haver mais de um servidor XUI — cada canal consulta o seu.
 *
 * Canais fora desse padrão simplesmente não têm EPG, e a resposta diz isso em
 * vez de fingir uma grade vazia.
 */

/** Quanto tempo a grade de um canal fica em memória antes de ser rebuscada. */
const VALIDADE_CACHE_MS = 10 * 60_000;

/** Quantas consultas simultâneas ao XUI. Acima disso ele começa a recusar. */
const SIMULTANEAS = 6;

export interface ProgramaEpg {
  id: string;
  titulo: string;
  descricao: string;
  inicio: string | null;
  fim: string | null;
  /** Está passando neste momento? */
  agora: boolean;
}

export interface EpgDoCanal {
  idcanal: number;
  canal: string;
  /** false quando a URL do canal não é de um servidor XUI. */
  temEpg: boolean;
  /** Preenchido quando a consulta ao XUI falhou. */
  erro?: string;
  programas: ProgramaEpg[];
}

interface DadosXui {
  base: string;
  usuario: string;
  senha: string;
  stream: number;
}

/**
 * Lê `https://servidor/usuario/senha/123.m3u8`.
 *
 * A extensão é opcional: o XUI aceita a URL sem ela, e há canais cadastrados
 * das duas formas.
 */
export function analisarUrlXui(url: string): DadosXui | null {
  const casa = /^(https?:\/\/[^/]+)\/([^/]+)\/([^/]+)\/(\d+)(?:\.[A-Za-z0-9]+)?$/.exec(
    String(url || "").trim(),
  );
  if (!casa) return null;
  return {
    base: casa[1],
    usuario: casa[2],
    senha: casa[3],
    stream: Number(casa[4]),
  };
}

/** O XUI manda título e descrição em base64. */
function decodificar(valor: unknown): string {
  const texto = String(valor ?? "").trim();
  if (!texto) return "";
  try {
    const bruto = Buffer.from(texto, "base64").toString("utf8");
    // Base64 inválido não estoura: devolve lixo. Se ao recodificar não bate,
    // o valor original já era texto puro.
    if (Buffer.from(bruto, "utf8").toString("base64").replace(/=+$/, "") ===
        texto.replace(/=+$/, "")) {
      return bruto;
    }
    return texto;
  } catch {
    return texto;
  }
}

/**
 * O XUI mistura formatos: `start` costuma vir "YYYY-MM-DD HH:mm:ss" e `end`
 * às vezes chega como epoch. Os campos `*_timestamp` são os confiáveis.
 */
function paraIso(timestamp: unknown, texto: unknown): string | null {
  const epoch = Number(timestamp);
  if (Number.isFinite(epoch) && epoch > 0) {
    return new Date(epoch * 1000).toISOString();
  }
  const t = String(texto ?? "").trim();
  if (!t) return null;
  const data = new Date(t.replace(" ", "T") + "Z");
  return Number.isNaN(data.getTime()) ? null : data.toISOString();
}

interface Cacheado {
  em: number;
  programas: ProgramaEpg[];
}

class TvWipEpgService {
  /** Chave: base|usuario|stream. */
  private cache = new Map<string, Cacheado>();

  /** Consulta a grade de um stream no XUI. */
  private async buscarNoXui(
    dados: DadosXui,
    limite: number,
  ): Promise<ProgramaEpg[]> {
    const chave = `${dados.base}|${dados.usuario}|${dados.stream}`;
    const guardado = this.cache.get(chave);
    if (guardado && Date.now() - guardado.em < VALIDADE_CACHE_MS) {
      return guardado.programas;
    }

    const resposta = await axios.get(`${dados.base}/player_api.php`, {
      params: {
        username: dados.usuario,
        password: dados.senha,
        action: "get_short_epg",
        stream_id: dados.stream,
        limit: limite,
      },
      timeout: 20000,
    });

    const listagens: any[] = resposta.data?.epg_listings || [];
    const agora = Date.now();

    const programas: ProgramaEpg[] = listagens.map((p) => {
      const inicio = paraIso(p.start_timestamp, p.start);
      const fim = paraIso(p.stop_timestamp, p.stop ?? p.end);
      return {
        id: String(p.id ?? ""),
        titulo: decodificar(p.title),
        descricao: decodificar(p.description),
        inicio,
        fim,
        agora:
          !!inicio &&
          !!fim &&
          new Date(inicio).getTime() <= agora &&
          new Date(fim).getTime() > agora,
      };
    });

    this.cache.set(chave, { em: Date.now(), programas });
    return programas;
  }

  /** Grade de um canal do nosso cadastro. */
  async doCanal(idcanal: number, limite = 8): Promise<EpgDoCanal> {
    const canal = await CanaisSource.getRepository(Canal).findOne({
      where: { idcanal },
    });
    if (!canal) throw new Error("Canal não encontrado.");
    return this.doCanalCarregado(canal, limite);
  }

  private async doCanalCarregado(
    canal: Canal,
    limite: number,
  ): Promise<EpgDoCanal> {
    const dados = analisarUrlXui(canal.url);

    if (!dados) {
      return {
        idcanal: canal.idcanal,
        canal: canal.canal,
        temEpg: false,
        programas: [],
      };
    }

    try {
      return {
        idcanal: canal.idcanal,
        canal: canal.canal,
        temEpg: true,
        programas: await this.buscarNoXui(dados, limite),
      };
    } catch (e: any) {
      // Um canal com problema não pode derrubar a grade inteira.
      return {
        idcanal: canal.idcanal,
        canal: canal.canal,
        temEpg: true,
        erro: e?.message || "Falha ao consultar o XUI.",
        programas: [],
      };
    }
  }

  /**
   * Grade de vários canais, em paralelo limitado — o XUI recusa conexões
   * quando recebe dezenas de consultas de uma vez.
   */
  async deVarios(idcanais: number[], limite = 4): Promise<EpgDoCanal[]> {
    const ids = Array.from(new Set(idcanais.filter((n) => Number.isFinite(n))));
    if (ids.length === 0) return [];

    const canais = await CanaisSource.getRepository(Canal).find();
    const alvos = canais.filter((c) => ids.includes(c.idcanal));

    const resultado: EpgDoCanal[] = [];
    for (let i = 0; i < alvos.length; i += SIMULTANEAS) {
      const lote = alvos.slice(i, i + SIMULTANEAS);
      resultado.push(
        ...(await Promise.all(
          lote.map((c) => this.doCanalCarregado(c, limite)),
        )),
      );
    }
    return resultado;
  }
}

export default new TvWipEpgService();
