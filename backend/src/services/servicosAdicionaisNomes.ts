/**
 * Monta o nome comercial (descrição completa) dos serviços adicionais.
 *
 * O boleto do mkauth imprime literalmente sis_sercontratos.nome ("Valor
 * adicional: <nome>"), então o cadastro grava ali o nome comercial completo
 * ("WatchTV Brasil R$ 49,90", "4 Canais de Gravação em Nuvem 20 Gb de
 * Armazenamento compartilhado") em vez da tag crua.
 *
 * Como o mesmo campo continua sendo o único identificador do tipo de serviço,
 * toda consulta passa por `tagDoServico` (TypeScript) ou `sqlTagServico` (SQL),
 * que reconhecem tanto o nome novo quanto as tags antigas ainda gravadas.
 */
import { In } from "typeorm";

import CamsSource from "../database/CamsSource";
import { CameraCliente } from "../entities/CameraCliente";
import { Camera } from "../entities/Camera";
import {
  STORAGE_PLANS,
  DEFAULT_STORAGE_GB,
  maxCamerasFor,
} from "../config/cameraStoragePlans";
import {
  nomeStreaming,
  nomeStreamingColab,
  nomeCamera,
} from "../config/servicosAdicionais";

export interface ResumoCameras {
  /** Cota contratada, em GB. */
  storageGb: number;
  /** Câmeras efetivamente cadastradas no portal. */
  canais: number;
}

/** Plano deduzido do valor cobrado no contrato (usado quando falta a conta). */
function planoPorValor(valor: number): number {
  const v = Number(valor || 0);
  const plano = STORAGE_PLANS.find((p) => Math.abs(p.priceBRL - v) < 0.005);
  return plano?.gb ?? DEFAULT_STORAGE_GB;
}

/** Cota do plano deduzida do valor cobrado, quando não há conta no wip_cams. */
export function storageGbDoValor(valor: number): number {
  return planoPorValor(valor);
}

/**
 * Lê as contas de câmeras (banco wip_cams) de vários logins de uma vez.
 * Retorna um mapa por login em MAIÚSCULAS; vazio se o banco estiver fora.
 */
export async function buscarResumoCameras(
  logins: string[],
): Promise<Map<string, ResumoCameras>> {
  const mapa = new Map<string, ResumoCameras>();
  const alvos = Array.from(
    new Set(logins.map((l) => String(l || "").trim()).filter(Boolean)),
  );
  if (alvos.length === 0) return mapa;

  try {
    const clientes = await CamsSource.getRepository(CameraCliente).find({
      where: { login: In(alvos) },
    });
    if (clientes.length === 0) return mapa;

    const ids = clientes.map((c) => Number(c.id));
    const contagens = (await CamsSource.getRepository(Camera)
      .createQueryBuilder("cam")
      .select("cam.cliente_id", "cliente_id")
      .addSelect("COUNT(*)", "total")
      .where("cam.cliente_id IN (:...ids)", { ids })
      .groupBy("cam.cliente_id")
      .getRawMany()) as { cliente_id: number; total: any }[];

    const porId = new Map<number, number>(
      contagens.map((r) => [Number(r.cliente_id), Number(r.total || 0)]),
    );

    for (const c of clientes) {
      mapa.set(c.login.trim().toUpperCase(), {
        storageGb: c.storage_gb,
        canais: porId.get(Number(c.id)) ?? 0,
      });
    }
  } catch (e: any) {
    console.warn("Erro ao consultar contas de câmeras:", e?.message);
  }
  return mapa;
}

/** Atalho para um login só. */
export async function buscarResumoCameraDeUmLogin(
  login: string,
): Promise<ResumoCameras | null> {
  const mapa = await buscarResumoCameras([login]);
  return mapa.get(String(login || "").trim().toUpperCase()) ?? null;
}

/**
 * Nome do serviço de câmeras. Sem a conta no wip_cams (banco fora do ar ou
 * cliente ainda não configurado), o plano é deduzido do valor do contrato e os
 * canais caem no limite desse plano.
 */
export function nomeServicoCamera(
  resumo: ResumoCameras | null | undefined,
  valorContrato: number,
): string {
  if (resumo) return nomeCamera(resumo.canais, resumo.storageGb);
  const gb = planoPorValor(valorContrato);
  return nomeCamera(maxCamerasFor(gb), gb);
}

/**
 * Nome de exibição de um item de sis_sercontratos. Serviços fora do trio
 * conhecido voltam com o próprio nome gravado.
 */
export function nomeServicoContrato(
  nome: string,
  valor: number,
  resumoCamera?: ResumoCameras | null,
): string {
  const tag = String(nome || "").trim().toUpperCase();
  if (tag === "STREAMER") return nomeStreaming(Number(valor || 0));
  if (tag === "STREAMER_COLAB") return nomeStreamingColab();
  if (tag === "CAMERA") return nomeServicoCamera(resumoCamera, Number(valor || 0));
  return nome;
}

/** Tags gravadas historicamente (e ainda aceitas) em sis_sercontratos.nome. */
export const TAGS_SERVICO = ["STREAMER", "STREAMER_COLAB", "CAMERA"] as const;
export type TagServico = (typeof TAGS_SERVICO)[number];

/**
 * Descobre o tipo de serviço a partir do que está gravado em
 * sis_sercontratos.nome — aceita a tag antiga e o nome comercial novo.
 * Nomes desconhecidos voltam como estão (em maiúsculas), para serviços
 * cadastrados direto no mkauth continuarem intactos.
 */
export function tagDoServico(nome: string): string {
  const t = String(nome || "").trim().toUpperCase();
  if ((TAGS_SERVICO as readonly string[]).includes(t)) return t;
  if (t.startsWith("WATCHTV BRASIL COLABORADOR")) return "STREAMER_COLAB";
  if (t.startsWith("WATCHTV BRASIL")) return "STREAMER";
  if (t.includes("CANAIS DE GRAVA") || t.includes("CANAL DE GRAVA")) {
    return "CAMERA";
  }
  return t;
}

/**
 * Versão SQL de `tagDoServico`, para usar no lugar de `UPPER(TRIM(nome))` nas
 * consultas. Recebe a coluna (ex.: "s.nome") e devolve a expressão que
 * normaliza o valor gravado de volta para a tag.
 */
export function sqlTagServico(coluna: string): string {
  const c = `UPPER(TRIM(${coluna}))`;
  return (
    `CASE` +
    ` WHEN ${c} LIKE 'WATCHTV BRASIL COLABORADOR%' THEN 'STREAMER_COLAB'` +
    ` WHEN ${c} LIKE 'WATCHTV BRASIL%' THEN 'STREAMER'` +
    ` WHEN ${c} LIKE '%CANAIS DE GRAVA%' THEN 'CAMERA'` +
    ` WHEN ${c} LIKE '%CANAL DE GRAVA%' THEN 'CAMERA'` +
    ` ELSE ${c} END`
  );
}

/**
 * Nome a gravar em sis_sercontratos.nome — é exatamente o texto que sai no
 * boleto. Para câmeras usa o limite do plano (e não quantas câmeras estão
 * cadastradas no portal), para o nome não envelhecer a cada câmera adicionada:
 * ele só muda quando o plano muda.
 */
export function nomeContratoParaGravar(
  tag: string,
  valor: number,
  storageGb?: number,
): string {
  const t = tagDoServico(tag);
  if (t === "STREAMER") return nomeStreaming(Number(valor || 0));
  if (t === "STREAMER_COLAB") return nomeStreamingColab();
  if (t === "CAMERA") {
    const gb = storageGb ?? DEFAULT_STORAGE_GB;
    return nomeCamera(maxCamerasFor(gb), gb);
  }
  return String(tag || "").trim();
}
