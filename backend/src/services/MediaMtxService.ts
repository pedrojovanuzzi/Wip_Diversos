import axios, { AxiosInstance } from "axios";
import dotenv from "dotenv";
import AppDataSource from "../database/DataSource";
import { Camera } from "../entities/Camera";

dotenv.config();

/**
 * Wrapper sobre a API HTTP de controle do MediaMTX (v3).
 * O backend NÃO processa vídeo — apenas cadastra/remove os "paths" (uma câmera = um path),
 * lista gravações e re-sincroniza o estado no boot. O MediaMTX roda em container separado.
 *
 * Docs: https://github.com/bluenviron/mediamtx#api
 */

const API_URL = (process.env.MEDIAMTX_API_URL || "http://mediamtx:9997").replace(
  /\/$/,
  "",
);
// Base pública para o navegador (WHEP/WebRTC), ex: https://cam.seudominio.com
const WEBRTC_PUBLIC = (process.env.MEDIAMTX_WEBRTC_PUBLIC || "").replace(
  /\/$/,
  "",
);
// Base pública do playback server (porta 9996), para reproduzir gravações.
const PLAYBACK_PUBLIC = (process.env.MEDIAMTX_PLAYBACK_PUBLIC || "").replace(
  /\/$/,
  "",
);
const RECORD_DELETE_AFTER = process.env.MEDIAMTX_RECORD_DELETE_AFTER || "72h";

export interface RecordingSegment {
  start: string;
  duration?: number;
  url?: string;
}

class MediaMtxService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_URL,
      timeout: 15_000,
      headers: { "Content-Type": "application/json" },
    });
  }

  /** Cadastra (ou regrava) o path de uma câmera. `record` liga/desliga a gravação. */
  public async addPath(
    pathName: string,
    rtspUrl: string,
    record: boolean = true,
  ): Promise<void> {
    const body = {
      source: rtspUrl,
      sourceOnDemand: false,
      record,
      recordDeleteAfter: RECORD_DELETE_AFTER,
    };
    try {
      await this.api.post(
        `/v3/config/paths/add/${encodeURIComponent(pathName)}`,
        body,
      );
    } catch (e: any) {
      // Se o path já existir, substitui a config.
      if (e?.response?.status === 400) {
        await this.api.post(
          `/v3/config/paths/replace/${encodeURIComponent(pathName)}`,
          body,
        );
        return;
      }
      throw e;
    }
  }

  /** Liga/desliga a gravação de um path já existente (sem derrubar o ao vivo). */
  public async setRecord(pathName: string, record: boolean): Promise<void> {
    await this.api.patch(
      `/v3/config/paths/patch/${encodeURIComponent(pathName)}`,
      { record },
    );
  }

  /** Remove o path de uma câmera (ignora 404). */
  public async removePath(pathName: string): Promise<void> {
    try {
      await this.api.delete(
        `/v3/config/paths/delete/${encodeURIComponent(pathName)}`,
      );
    } catch (e: any) {
      if (e?.response?.status === 404) return;
      throw e;
    }
  }

  /** Lista os segmentos de gravação de um path. */
  public async listRecordings(pathName: string): Promise<RecordingSegment[]> {
    try {
      const { data } = await this.api.get(
        `/v3/recordings/get/${encodeURIComponent(pathName)}`,
      );
      return (data?.segments || []) as RecordingSegment[];
    } catch (e: any) {
      if (e?.response?.status === 404) return [];
      throw e;
    }
  }

  /** Estado ao vivo do path (online/leitura), útil para diagnóstico. */
  public async getPathState(pathName: string): Promise<any | null> {
    try {
      const { data } = await this.api.get(
        `/v3/paths/get/${encodeURIComponent(pathName)}`,
      );
      return data;
    } catch (e: any) {
      if (e?.response?.status === 404) return null;
      throw e;
    }
  }

  /** URL pública WHEP (WebRTC) para o navegador assistir ao vivo. */
  public buildWhepUrl(pathName: string, token?: string): string {
    const base = WEBRTC_PUBLIC || API_URL;
    const url = `${base}/${encodeURIComponent(pathName)}/whep`;
    return token ? `${url}?token=${encodeURIComponent(token)}` : url;
  }

  /** URL do playback server para reproduzir um trecho gravado. */
  public buildPlaybackUrl(
    pathName: string,
    start: string,
    duration: number,
    token?: string,
  ): string {
    const base = PLAYBACK_PUBLIC || `${API_URL}`;
    const params = new URLSearchParams({
      path: pathName,
      start,
      duration: String(duration),
    });
    if (token) params.set("token", token);
    return `${base}/get?${params.toString()}`;
  }

  /**
   * Re-sincroniza todas as câmeras ativas do banco para o MediaMTX.
   * Chamado no boot porque o MediaMTX guarda os paths adicionados via API em memória.
   */
  public async syncAllActive(): Promise<void> {
    try {
      const repo = AppDataSource.getRepository(Camera);
      const cameras = await repo.find({ where: { ativo: true } });
      for (const cam of cameras) {
        try {
          await this.addPath(cam.path_name, cam.rtsp_url, cam.gravando);
        } catch (e: any) {
          console.error(
            `MediaMTX: falha ao sincronizar câmera ${cam.path_name}:`,
            e?.message,
          );
        }
      }
      if (cameras.length) {
        console.log(`📹 MediaMTX: ${cameras.length} câmera(s) sincronizada(s).`);
      }
    } catch (e: any) {
      console.error("MediaMTX: falha no syncAllActive:", e?.message);
    }
  }
}

export default new MediaMtxService();
