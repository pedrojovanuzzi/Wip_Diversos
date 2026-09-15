import { DOMParser } from "xmldom";
import moment from "moment-timezone";

/**
 * XML da NFS-e Nacional no web service IssWebWSNacional (Fiorilli).
 *
 * O web service antigo (ABRASF 2.01, `NfseXmlFactory`) continua existindo para
 * as notas emitidas antes da troca; este arquivo monta só o modelo novo:
 * DPS (Declaração de Prestação de Serviço), lote síncrono, evento de
 * cancelamento e consulta.
 *
 * Namespaces: os envelopes (lote, cancelamento, consulta) ficam no namespace
 * da Fiorilli e os documentos fiscais (DPS, pedRegEvento, NFSe) no namespace
 * nacional. O schema publicado no WSDL diz que DPS seria da Fiorilli, mas o
 * servidor recusa ("Expected elements are {sped.fazenda.gov.br/nfse}DPS").
 */

export const NS_FIORILLI = "http://www.fiorilli.com.br/nfse-nacional";
export const NS_NFSE = "http://www.sped.fazenda.gov.br/nfse";

export const URL_WS_NACIONAL = {
  producao:
    "https://wsnfe.arealva.sp.gov.br:8443/IssWeb-ejb/IssWebWSNacional/IssWebWSNacionalPortType",
  homologacao:
    "http://fi1.fiorilli.com.br:5663/IssWeb-ejb/IssWebWSNacional/IssWebWSNacionalPortType",
};

/** SOAPAction de cada operação, como está no binding do WSDL. */
export const ACAO_NACIONAL = {
  lote: "recepcionarLoteDpsSincrono",
  cancelar: "cancelarNFSe",
  consultar: "consultarNfse",
};

// A prefeitura recusa "1.00" (N13: "Utilize a versão '1.01'").
const VERSAO_LEIAUTE = "1.01";
const VERSAO_APLICATIVO = "WipDiversos1.0";

export interface DadosDps {
  ambiente: string;
  serie: string;
  numero: number;
  /** Município emissor e de prestação (IBGE, 7 dígitos). */
  codigoMunicipio: string;
  prestador: {
    cnpj: string;
    inscricaoMunicipal: string;
    /** Mesmo valor que ia no ABRASF: 1 = optante do Simples, 2 = não. */
    optanteSimples: string | number;
  };
  tomador: {
    cpfCnpj: string;
    nome: string;
    logradouro: string;
    numero: string;
    complemento: string;
    bairro: string;
    codigoMunicipio: string;
    cep: string;
    telefone: string;
    email: string;
  };
  servico: {
    /** Código do item da lista (ex.: "140201", "01.05"). */
    itemListaServico: string;
    discriminacao: string;
  };
  valores: {
    valorServicos: number;
    aliquota: string | number;
    /** Mesmo valor que ia no ABRASF: 1 = ISS retido, 2 = não retido. */
    issRetido: string | number;
  };
}

export interface NotaNacional {
  numero: string;
  chave: string;
  idDps: string;
  elemento: Element;
}

export interface MensagemNacional {
  codigo: string;
  mensagem: string;
  correcao?: string;
  idDps?: string;
}

function escapar(texto: unknown): string {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/\s+/g, " ")
    .trim();
}

function digitos(texto: unknown): string {
  return String(texto ?? "").replace(/\D/g, "");
}

/** Corta no limite do leiaute antes de escapar, para não partir uma entidade. */
function conteudo(valor: unknown, limite?: number): string {
  let bruto = String(valor ?? "").replace(/\s+/g, " ").trim();
  if (limite) bruto = bruto.slice(0, limite).trim();
  return escapar(bruto);
}

/** Tag só quando há valor: o leiaute nacional não aceita elemento vazio. */
function tagOpcional(nome: string, valor: unknown, limite?: number): string {
  const texto = conteudo(valor, limite);
  return texto ? `<${nome}>${texto}</${nome}>` : "";
}

function tag(nome: string, valor: unknown, limite?: number): string {
  return `<${nome}>${conteudo(valor, limite)}</${nome}>`;
}

/** Série da DPS: só dígitos (a série "wip99" de homologação vira "99"). */
export function serieDps(serieRps: unknown): string {
  const serie = digitos(serieRps).replace(/^0+(?=\d)/, "");
  return (serie || "1").slice(-5);
}

/**
 * Código de tributação nacional (6 dígitos: item, subitem e desdobro).
 * "140201" já vem completo; "17.01" vira "170101".
 */
export function codigoTributacaoNacional(itemListaServico: unknown): string {
  const codigo = digitos(itemListaServico);
  if (codigo.length === 4) return `${codigo}01`;
  return codigo.padStart(6, "0").slice(0, 6);
}

export function tipoAmbiente(ambiente: string): "1" | "2" {
  return ambiente === "homologacao" ? "2" : "1";
}

/** Data/hora com fuso de Brasília, no formato AAAA-MM-DDThh:mm:ss-03:00. */
function dataHoraBrasilia(data: Date = new Date()): string {
  return moment(data).tz("America/Sao_Paulo").format("YYYY-MM-DDTHH:mm:ssZ");
}

function dataBrasilia(data: Date = new Date()): string {
  return moment(data).tz("America/Sao_Paulo").format("YYYY-MM-DD");
}

/**
 * Id da DPS: "DPS" + município (7) + tipo de inscrição (1 = CPF, 2 = CNPJ)
 * + inscrição (14) + série (5) + número (15).
 */
export function idDps(
  codigoMunicipio: string,
  cnpjPrestador: string,
  serie: string,
  numero: number,
): string {
  const inscricao = digitos(cnpjPrestador);
  const tipoInscricao = inscricao.length === 11 ? "1" : "2";
  return (
    "DPS" +
    digitos(codigoMunicipio).padStart(7, "0") +
    tipoInscricao +
    inscricao.padStart(14, "0") +
    serieDps(serie).padStart(5, "0") +
    String(numero).padStart(15, "0")
  );
}

export class NfseNacionalXmlFactory {
  /**
   * DPS de uma nota, pronta para ser assinada em `infDPS`.
   *
   * Equivalências com o RPS ABRASF que era enviado:
   * - OptanteSimplesNacional 1 → opSimpNac 3 (ME/EPP) com apuração do ISS pelo
   *   Simples (regApTribSN 1); o regime especial "6" (ME/EPP) do ABRASF é
   *   justamente isso, então regEspTrib fica 0 (nenhum).
   * - OptanteSimplesNacional 2 → opSimpNac 1 (não optante).
   * - IssRetido 1 → tpRetISSQN 2 (retido pelo tomador); 2 → 1 (não retido).
   * - A alíquota só vai quando o prestador é ME/EPP do Simples ou há retenção:
   *   fora disso quem define é o cadastro do município.
   */
  createDpsXml(dados: DadosDps): { id: string; xml: string } {
    const serie = serieDps(dados.serie);
    const id = idDps(
      dados.codigoMunicipio,
      dados.prestador.cnpj,
      serie,
      dados.numero,
    );

    const optante = String(dados.prestador.optanteSimples) === "1";
    const retido = String(dados.valores.issRetido) === "1";
    const regTrib = optante
      ? "<opSimpNac>3</opSimpNac><regApTribSN>1</regApTribSN><regEspTrib>0</regEspTrib>"
      : "<opSimpNac>1</opSimpNac><regEspTrib>0</regEspTrib>";

    const documento = digitos(dados.tomador.cpfCnpj);
    const tagDocumento = documento.length === 11 ? "CPF" : "CNPJ";

    const cepTomador = digitos(dados.tomador.cep);
    const municipioTomador = digitos(dados.tomador.codigoMunicipio);
    const temEndereco =
      cepTomador.length === 8 &&
      municipioTomador.length === 7 &&
      escapar(dados.tomador.logradouro) !== "" &&
      escapar(dados.tomador.bairro) !== "";
    const endereco = temEndereco
      ? `<end><endNac><cMun>${municipioTomador}</cMun><CEP>${cepTomador}</CEP></endNac>` +
        tag("xLgr", dados.tomador.logradouro, 255) +
        tag("nro", String(dados.tomador.numero ?? "").trim() || "S/N", 60) +
        tagOpcional("xCpl", dados.tomador.complemento, 156) +
        tag("xBairro", dados.tomador.bairro, 60) +
        `</end>`
      : "";

    const telefone = digitos(dados.tomador.telefone);
    const aliquota = Number(String(dados.valores.aliquota).replace(",", "."));
    const pAliq =
      (optante || retido) && Number.isFinite(aliquota) && aliquota > 0
        ? `<pAliq>${aliquota.toFixed(2)}</pAliq>`
        : "";

    // Um minuto para trás: a prefeitura recusa emissão "no futuro" quando o
    // relógio do servidor está adiantado. A competência é o mesmo dia.
    const emissao = new Date(Date.now() - 60_000);

    const xml =
      `<DPS xmlns="${NS_NFSE}" versao="${VERSAO_LEIAUTE}">` +
      `<infDPS Id="${id}">` +
      `<tpAmb>${tipoAmbiente(dados.ambiente)}</tpAmb>` +
      `<dhEmi>${dataHoraBrasilia(emissao)}</dhEmi>` +
      `<verAplic>${VERSAO_APLICATIVO}</verAplic>` +
      `<serie>${serie}</serie>` +
      `<nDPS>${dados.numero}</nDPS>` +
      `<dCompet>${dataBrasilia(emissao)}</dCompet>` +
      `<tpEmit>1</tpEmit>` +
      `<cLocEmi>${digitos(dados.codigoMunicipio)}</cLocEmi>` +
      `<prest>` +
      `<CNPJ>${digitos(dados.prestador.cnpj)}</CNPJ>` +
      tagOpcional("IM", dados.prestador.inscricaoMunicipal, 15) +
      `<regTrib>${regTrib}</regTrib>` +
      `</prest>` +
      `<toma>` +
      `<${tagDocumento}>${documento}</${tagDocumento}>` +
      tag("xNome", dados.tomador.nome, 300) +
      endereco +
      (telefone.length >= 6 ? `<fone>${telefone.slice(0, 20)}</fone>` : "") +
      tagOpcional("email", dados.tomador.email, 80) +
      `</toma>` +
      `<serv>` +
      `<locPrest><cLocPrestacao>${digitos(dados.codigoMunicipio)}</cLocPrestacao></locPrest>` +
      `<cServ>` +
      `<cTribNac>${codigoTributacaoNacional(dados.servico.itemListaServico)}</cTribNac>` +
      tag("xDescServ", dados.servico.discriminacao, 2000) +
      `</cServ>` +
      `</serv>` +
      `<valores>` +
      `<vServPrest><vServ>${Number(dados.valores.valorServicos).toFixed(2)}</vServ></vServPrest>` +
      `<trib>` +
      `<tribMun><tribISSQN>1</tribISSQN><tpRetISSQN>${retido ? "2" : "1"}</tpRetISSQN>${pAliq}</tribMun>` +
      `<totTrib><indTotTrib>0</indTotTrib></totTrib>` +
      `</trib>` +
      `</valores>` +
      `</infDPS>` +
      `</DPS>`;

    return { id, xml };
  }

  /**
   * Lote síncrono com as DPS já assinadas.
   *
   * O número do lote não pode se repetir: a prefeitura guarda os já recebidos
   * e recusa o repetido (E233 "Lote já processado").
   */
  createLoteSincronoSoap(
    numeroLote: number,
    cnpj: string,
    inscricaoMunicipal: string,
    dpsAssinadas: string[],
  ): string {
    const envio =
      `<RecepcionarLoteDpsSincronoEnvio xmlns="${NS_FIORILLI}">` +
      `<LoteDps Id="lote${numeroLote}">` +
      `<NumeroLote>${numeroLote}</NumeroLote>` +
      `<CNPJ>${digitos(cnpj)}</CNPJ>` +
      tagOpcional("IM", inscricaoMunicipal) +
      `<QuantidadeDps>${dpsAssinadas.length}</QuantidadeDps>` +
      `<ListaDps>${dpsAssinadas.join("")}</ListaDps>` +
      `</LoteDps>` +
      `</RecepcionarLoteDpsSincronoEnvio>`;
    return this.envelope(envio);
  }

  /**
   * Pedido de cancelamento (evento 101101), pronto para ser assinado em
   * `infPedReg`. O motivo segue o que ia no ABRASF (código 2, serviço não
   * prestado).
   */
  createPedidoCancelamentoXml(opts: {
    ambiente: string;
    chaveNfse: string;
    cnpjAutor: string;
    inscricaoMunicipal: string;
    codigoMotivo?: "1" | "2" | "9";
    motivo?: string;
  }): string {
    const chave = digitos(opts.chaveNfse);
    const id = `PRE${chave}101101`;
    const motivo =
      opts.motivo || "Servico nao prestado - cancelamento solicitado pelo prestador";
    return (
      `<CancelarNFSeEnvio xmlns="${NS_FIORILLI}">` +
      tagOpcional("IM", opts.inscricaoMunicipal) +
      `<pedRegEvento xmlns="${NS_NFSE}" versao="${VERSAO_LEIAUTE}">` +
      `<infPedReg Id="${id}">` +
      `<tpAmb>${tipoAmbiente(opts.ambiente)}</tpAmb>` +
      `<verAplic>${VERSAO_APLICATIVO}</verAplic>` +
      `<dhEvento>${dataHoraBrasilia(new Date(Date.now() - 60_000))}</dhEvento>` +
      `<CNPJAutor>${digitos(opts.cnpjAutor)}</CNPJAutor>` +
      `<chNFSe>${chave}</chNFSe>` +
      `<e101101>` +
      `<xDesc>Cancelamento de NFS-e</xDesc>` +
      `<cMotivo>${opts.codigoMotivo || "2"}</cMotivo>` +
      tag("xMotivo", motivo, 255) +
      `</e101101>` +
      `</infPedReg>` +
      `</pedRegEvento>` +
      `</CancelarNFSeEnvio>`
    );
  }

  createCancelamentoSoap(pedidoAssinado: string): string {
    return this.envelope(pedidoAssinado);
  }

  /** Consulta por chave de acesso ou, sem ela, pelo número e série da DPS. */
  createConsultaSoap(opts: {
    cnpj: string;
    inscricaoMunicipal: string;
    chaveNfse?: string | null;
    numeroDps?: string | number;
    serieDps?: string;
  }): string {
    // Com a chave, a prefeitura não aceita CPF/CNPJ junto (N10); pela DPS, o
    // CNPJ do prestador é o que identifica de quem é a série/número.
    const envio = opts.chaveNfse
      ? `<ConsultarNfseEnvio xmlns="${NS_FIORILLI}">` +
        tagOpcional("IM", opts.inscricaoMunicipal) +
        `<ChaveNFSe>${digitos(opts.chaveNfse)}</ChaveNFSe>` +
        `</ConsultarNfseEnvio>`
      : `<ConsultarNfseEnvio xmlns="${NS_FIORILLI}">` +
        `<CNPJ>${digitos(opts.cnpj)}</CNPJ>` +
        tagOpcional("IM", opts.inscricaoMunicipal) +
        `<NumeroDPS>${digitos(opts.numeroDps)}</NumeroDPS>` +
        `<SerieDPS>${serieDps(opts.serieDps)}</SerieDPS>` +
        `</ConsultarNfseEnvio>`;
    return this.envelope(envio);
  }

  private envelope(corpo: string): string {
    return (
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">` +
      `<soapenv:Header/>` +
      `<soapenv:Body>${corpo}</soapenv:Body>` +
      `</soapenv:Envelope>`
    );
  }
}

// ---------------------------------------------------------------------------
// Leitura das respostas
// ---------------------------------------------------------------------------

function elementos(raiz: Node | null | undefined, nome: string): Element[] {
  const achados: Element[] = [];
  const visitar = (no: Node) => {
    for (let i = 0; i < no.childNodes.length; i++) {
      const filho = no.childNodes[i];
      if (filho.nodeType !== 1) continue;
      const el = filho as Element;
      if ((el.localName || el.nodeName.replace(/^.*:/, "")) === nome)
        achados.push(el);
      visitar(el);
    }
  };
  if (raiz) visitar(raiz);
  return achados;
}

function filhoDireto(pai: Element | null | undefined, nome: string): Element | null {
  if (!pai) return null;
  for (let i = 0; i < pai.childNodes.length; i++) {
    const filho = pai.childNodes[i];
    if (
      filho.nodeType === 1 &&
      ((filho as Element).localName || filho.nodeName.replace(/^.*:/, "")) === nome
    )
      return filho as Element;
  }
  return null;
}

function texto(pai: Element | null | undefined, ...caminho: string[]): string {
  let atual: Element | null | undefined = pai;
  for (const nome of caminho) atual = filhoDireto(atual, nome);
  return atual?.textContent?.trim() || "";
}

export function lerXml(xml: string): Document {
  return new DOMParser({
    errorHandler: { warning: () => {}, error: () => {}, fatalError: () => {} },
  }).parseFromString(String(xml || ""), "text/xml");
}

/** Mensagens de erro/alerta da resposta, incluindo SOAP Fault. */
export function lerMensagens(xml: string): MensagemNacional[] {
  const doc = lerXml(xml);
  const mensagens: MensagemNacional[] = elementos(doc, "mensagem").map((m) => ({
    codigo: texto(m, "Codigo"),
    mensagem: texto(m, "Mensagem"),
    correcao: texto(m, "Correcao") || undefined,
    idDps: texto(m, "IdDPS") || undefined,
  }));
  for (const fault of elementos(doc, "Fault")) {
    mensagens.push({
      codigo: texto(fault, "faultcode") || "SOAP",
      mensagem: texto(fault, "faultstring") || fault.textContent?.trim() || "",
    });
  }
  return mensagens;
}

/** Status textual devolvido por operações como o cancelamento. */
export function lerStatus(xml: string): string {
  const [status] = elementos(lerXml(xml), "status");
  return status?.textContent?.trim() || "";
}

/** NFS-e autorizadas presentes na resposta (lote, consulta ou DPS avulsa). */
export function lerNotas(xml: string): NotaNacional[] {
  return elementos(lerXml(xml), "NFSe").map((nfse) => {
    const inf = filhoDireto(nfse, "infNFSe");
    const infDps = filhoDireto(filhoDireto(inf, "DPS"), "infDPS");
    return {
      numero: texto(inf, "nNFSe"),
      chave: (inf?.getAttribute("Id") || "").replace(/^NFS/, ""),
      idDps: infDps?.getAttribute("Id") || "",
      elemento: nfse,
    };
  });
}

/**
 * Converte a NFS-e nacional no mesmo formato que a consulta ABRASF devolvia
 * (`CompNfse.Nfse.InfNfse...`), para a impressão continuar igual.
 */
export function notaNacionalNoFormatoAbrasf(
  nota: NotaNacional,
  cancelada = false,
): Record<string, any> {
  const inf = filhoDireto(nota.elemento, "infNFSe");
  const emit = filhoDireto(inf, "emit");
  const enderEmit = filhoDireto(emit, "enderNac");
  const valoresNota = filhoDireto(inf, "valores");
  const infDps = filhoDireto(filhoDireto(inf, "DPS"), "infDPS");
  const prest = filhoDireto(infDps, "prest");
  const regTrib = filhoDireto(prest, "regTrib");
  const toma = filhoDireto(infDps, "toma");
  const endToma = filhoDireto(toma, "end");
  const serv = filhoDireto(infDps, "serv");
  const cServ = filhoDireto(serv, "cServ");
  const valoresDps = filhoDireto(infDps, "valores");
  const tribMun = filhoDireto(filhoDireto(valoresDps, "trib"), "tribMun");

  const opSimpNac = texto(regTrib, "opSimpNac");
  const cpf = texto(toma, "CPF");
  const cnpj = texto(toma, "CNPJ");
  const vServ = texto(valoresDps, "vServPrest", "vServ");

  return {
    CompNfse: {
      Nfse: {
        InfNfse: {
          Numero: nota.numero,
          CodigoVerificacao: nota.chave,
          DataEmissao: texto(inf, "dhProc"),
          PrestadorServico: {
            RazaoSocial: texto(emit, "xNome"),
            IdentificacaoPrestador: {
              CpfCnpj: { Cnpj: texto(emit, "CNPJ") },
              InscricaoMunicipal: texto(emit, "IM"),
            },
            Endereco: {
              Endereco: texto(enderEmit, "xLgr"),
              Numero: texto(enderEmit, "nro"),
              Complemento: texto(enderEmit, "xCpl"),
              Bairro: texto(enderEmit, "xBairro"),
              CodigoMunicipio: texto(enderEmit, "cMun"),
              Uf: texto(enderEmit, "UF"),
              Cep: texto(enderEmit, "CEP"),
            },
            Contato: {
              Telefone: texto(emit, "fone"),
              Email: texto(emit, "email"),
            },
          },
          DeclaracaoPrestacaoServico: {
            InfDeclaracaoPrestacaoServico: {
              Rps: {
                IdentificacaoRps: {
                  Numero: texto(infDps, "nDPS"),
                  Serie: texto(infDps, "serie"),
                  Tipo: "1",
                },
                DataEmissao: texto(infDps, "dhEmi").slice(0, 10),
                Status: "1",
              },
              Competencia: texto(infDps, "dCompet"),
              Servico: {
                Valores: {
                  ValorServicos: vServ,
                  Aliquota:
                    texto(tribMun, "pAliq") || texto(valoresNota, "pAliqAplic"),
                  ValorIss: texto(valoresNota, "vISSQN"),
                  ValorDeducoes: texto(valoresNota, "vCalcDR"),
                  DescontoIncondicionado: texto(
                    valoresDps,
                    "vDescCondIncond",
                    "vDescIncond",
                  ),
                  DescontoCondicionado: texto(
                    valoresDps,
                    "vDescCondIncond",
                    "vDescCond",
                  ),
                  ValorPis: "",
                  ValorCofins: "",
                  ValorInss: "",
                  ValorIr: "",
                  ValorCsll: "",
                  OutrasRetencoes: texto(valoresNota, "vTotalRet"),
                  ValorLiquidoNfse: texto(valoresNota, "vLiq"),
                },
                IssRetido: texto(tribMun, "tpRetISSQN") === "1" ? "2" : "1",
                ItemListaServico: texto(cServ, "cTribNac"),
                CodigoTributacaoMunicipio:
                  texto(cServ, "cTribMun") || texto(cServ, "cTribNac"),
                Discriminacao: texto(cServ, "xDescServ"),
                CodigoMunicipio: texto(serv, "locPrest", "cLocPrestacao"),
                ExigibilidadeISS:
                  texto(tribMun, "tribISSQN") === "1" ? "1" : "2",
              },
              Prestador: {
                CpfCnpj: { Cnpj: texto(prest, "CNPJ") },
                InscricaoMunicipal: texto(prest, "IM"),
              },
              Tomador: {
                IdentificacaoTomador: {
                  CpfCnpj: cpf ? { Cpf: cpf } : { Cnpj: cnpj },
                },
                RazaoSocial: texto(toma, "xNome"),
                Endereco: {
                  Endereco: texto(endToma, "xLgr"),
                  Numero: texto(endToma, "nro"),
                  Complemento: texto(endToma, "xCpl"),
                  Bairro: texto(endToma, "xBairro"),
                  CodigoMunicipio: texto(endToma, "endNac", "cMun"),
                  Uf: "",
                  Cep: texto(endToma, "endNac", "CEP"),
                },
                Contato: {
                  Telefone: texto(toma, "fone"),
                  Email: texto(toma, "email"),
                },
              },
              RegimeEspecialTributacao: opSimpNac === "3" ? "6" : "",
              OptanteSimplesNacional:
                opSimpNac === "2" || opSimpNac === "3" ? "1" : "2",
              IncentivoFiscal: "2",
            },
          },
        },
      },
      ...(cancelada ? { NfseCancelamento: { Cancelada: "1" } } : {}),
    },
  };
}
