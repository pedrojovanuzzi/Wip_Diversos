/**
 * Monta o nome comercial (descrição completa) dos serviços adicionais.
 *
 * O cadastro grava só a "tag" do serviço em sis_sercontratos ("STREAMER",
 * "STREAMER_COLAB", "CAMERA"). Nenhuma tela ou documento deve exibir a tag crua:
 * tudo passa por aqui para virar "WatchTV Brasil R$ 49,90" ou
 * "4 Canais de Gravação em Nuvem 20 Gb de Armazenamento compartilhado".
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
