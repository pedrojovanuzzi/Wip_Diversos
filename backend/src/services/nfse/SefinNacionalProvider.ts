import axios from "axios";
import * as fs from "fs";
import * as https from "https";
import * as zlib from "zlib";
import { processarCertificado } from "../../utils/certUtils";

/**
 * Cliente da API do Sistema Nacional NFS-e (Sefin Nacional).
 *
 * Desde 01/10/2026 Arealva emite pelo padrão nacional: o webservice da
 * Fiorilli (ISSWeb) ficou só para consulta das notas antigas. O XML (DPS e
 * pedido de evento) é o mesmo leiaute que já usávamos; muda o transporte:
 * REST com JSON, o XML vai compactado em GZip e codificado em Base64, e a
 * autenticação é o próprio certificado A1 na conexão (mTLS).
 *
 * Endpoints (Manual dos Contribuintes — Emissor Público Nacional):
 * - POST /nfse                     emite a NFS-e a partir da DPS
 * - GET  /nfse/{chaveAcesso}       consulta a NFS-e
 * - GET  /dps/{id}                 chave de acesso a partir do Id da DPS
 * - POST /nfse/{chaveAcesso}/eventos  registra evento (cancelamento)
 */

export const URL_SEFIN_NACIONAL = {
  producao:
    process.env.SEFIN_NACIONAL_URL || "https://sefin.nfse.gov.br/SefinNacional",
  homologacao:
    process.env.SEFIN_NACIONAL_URL_TEST ||
    "https://sefin.producaorestrita.nfse.gov.br/API/SefinNacional",
};

export interface MensagemSefin {
  codigo: string;
  mensagem: string;
  correcao?: string;
}

export interface ResultadoSefin {
  ok: boolean;
  status?: number;
  chaveAcesso?: string;
  idDps?: string;
  /** XML descompactado devolvido pela API (NFS-e ou evento). */
  xml?: string;
  erros: MensagemSefin[];
  alertas: MensagemSefin[];
  /** Corpo bruto, para log e diagnóstico. */
  bruto?: unknown;
}

const DECLARACAO = '<?xml version="1.0" encoding="UTF-8"?>';

/** XML → GZip → Base64, como a API exige nos campos *XmlGZipB64. */
export function compactar(xml: string): string {
  const conteudo = xml.trim().startsWith("<?xml") ? xml : DECLARACAO + xml;
  return zlib.gzipSync(Buffer.from(conteudo, "utf8")).toString("base64");
}

/** Base64 → GZip → XML. */
export function descompactar(b64?: string | null): string {
  if (!b64) return "";
  return zlib.gunzipSync(Buffer.from(b64, "base64")).toString("utf8");
}

/**
 * Lista de erros/alertas da API em qualquer das grafias que ela usa
 * (Codigo/codigo, Descricao/descricao/Mensagem, Complemento).
 */
function lerMensagens(lista: unknown): MensagemSefin[] {
  if (!Array.isArray(lista)) return [];
  return lista.map((m: any) => ({
    codigo: String(m?.Codigo ?? m?.codigo ?? ""),
    mensagem: String(
      m?.Descricao ?? m?.descricao ?? m?.Mensagem ?? m?.mensagem ?? "",
    ),
    correcao: m?.Complemento ?? m?.complemento ?? m?.Correcao ?? undefined,
  }));
}

export class SefinNacionalProvider {
  private baseUrl: string;

  constructor(
    private certPath: string,
    private tempDir: string,
    ambiente: string,
  ) {
    this.baseUrl =
      ambiente === "homologacao"
        ? URL_SEFIN_NACIONAL.homologacao
        : URL_SEFIN_NACIONAL.producao;
  }

  /** Conexão autenticada pelo certificado A1 (mTLS). */
  private agente(password: string) {
    const caminho = processarCertificado(this.certPath, password, this.tempDir);
    return new https.Agent({
      pfx: fs.readFileSync(caminho),
      passphrase: password,
    });
  }

  private async chamar(
    metodo: "get" | "post",
    caminho: string,
    password: string,
    corpo?: unknown,
  ): Promise<{ status: number; data: any }> {
    try {
      const resposta = await axios.request({
        method: metodo,
        url: `${this.baseUrl}${caminho}`,
        data: corpo,
        httpsAgent: this.agente(password),
        timeout: 60_000,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });
      return { status: resposta.status, data: resposta.data };
    } catch (err: any) {
      // Rejeição de negócio vem como 4xx com o corpo explicando o motivo.
      if (err?.response) {
        return { status: err.response.status, data: err.response.data };
      }
      throw err;
    }
  }

  private resultado(status: number, data: any): ResultadoSefin {
    const erros = lerMensagens(data?.erros ?? data?.Erros ?? data?.erro);
    const ok = status >= 200 && status < 300 && erros.length === 0;

    // Erro fora do formato esperado (403 de certificado, 500, HTML...): vira
    // uma mensagem só, para não sumir na tela.
    if (!ok && erros.length === 0) {
      erros.push({
        codigo: String(status),
        mensagem:
          typeof data === "string"
            ? data
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 300)
            : JSON.stringify(data ?? {}).slice(0, 300),
      });
    }

    return {
      ok,
      status,
      chaveAcesso: data?.chaveAcesso ?? data?.ChaveAcesso ?? undefined,
      idDps: data?.idDps ?? data?.idDPS ?? undefined,
      erros,
      alertas: lerMensagens(data?.alertas ?? data?.Alertas),
      bruto: data,
    };
  }

  /** Emite a NFS-e a partir da DPS já assinada. */
  async emitir(dpsAssinada: string, password: string): Promise<ResultadoSefin> {
    const { status, data } = await this.chamar("post", "/nfse", password, {
      dpsXmlGZipB64: compactar(dpsAssinada),
    });
    const r = this.resultado(status, data);
    r.xml = descompactar(data?.nfseXmlGZipB64);
    return r;
  }

  /** NFS-e pela chave de acesso. */
  async consultar(
    chaveAcesso: string,
    password: string,
  ): Promise<ResultadoSefin> {
    const { status, data } = await this.chamar(
      "get",
      `/nfse/${encodeURIComponent(chaveAcesso)}`,
      password,
    );
    const r = this.resultado(status, data);
    r.xml = descompactar(data?.nfseXmlGZipB64);
    return r;
  }

  /** Chave de acesso a partir do Id da DPS (nota que saiu sem resposta). */
  async chaveDaDps(idDps: string, password: string): Promise<ResultadoSefin> {
    const { status, data } = await this.chamar(
      "get",
      `/dps/${encodeURIComponent(idDps)}`,
      password,
    );
    return this.resultado(status, data);
  }

  /** Registra um evento (ex.: cancelamento 101101) já assinado. */
  async registrarEvento(
    chaveAcesso: string,
    pedidoAssinado: string,
    password: string,
  ): Promise<ResultadoSefin> {
    const { status, data } = await this.chamar(
      "post",
      `/nfse/${encodeURIComponent(chaveAcesso)}/eventos`,
      password,
      { pedidoRegistroEventoXmlGZipB64: compactar(pedidoAssinado) },
    );
    const r = this.resultado(status, data);
    r.xml = descompactar(data?.eventoXmlGZipB64);
    return r;
  }
}
