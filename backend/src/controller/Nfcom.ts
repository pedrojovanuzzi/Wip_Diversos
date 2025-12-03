import { create } from "xmlbuilder2";
import { Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";
import forge from "node-forge";
import { SignedXml } from "xml-crypto";
import axios from "axios";
import * as https from "https";
import { gunzipSync, gzipSync } from "zlib";
import { processarCertificado } from "../utils/certUtils";
import MkauthSource from "../database/MkauthSource";
import { ClientesEntities } from "../entities/ClientesEntities";
import { Faturas } from "../entities/Faturas";
import { NFCom } from "../entities/NFCom";
import dotenv from "dotenv";
import DataSource from "../database/DataSource";
import { Between, FindOptionsWhere, In, IsNull, Not } from "typeorm";
import { isNotEmpty } from "class-validator";
import { Jobs } from "../entities/Jobs";
dotenv.config();

// Interfaces para tipagem dos dados da NFCom
export interface INFComData {
  /** Bloco de Identificação da NFCom (ide) */
  ide: {
    cUF: "35";
    tpAmb: string;
    mod: "62"; // Modelo NFCom
    serie: string;
    nNF: string;
    cNF: string;
    cDV: string;
    dhEmi: string;
    tpEmis: "1";
    nSiteAutoriz: "0";
    cMunFG: "3503406";
    finNFCom: "0";
    tpFat: "0";
    verProc: "1";
  };

  /** Bloco do Emitente (emit) */
  emit: {
    CNPJ: string;
    IE: string;
    CRT: "1";
    xNome: "WIP TELECOM MULTIMIDIA EIRELI ME";
    xFant: "WIP TELECOM MULTIMIDIA EIRELI ME";
    enderEmit: {
      xLgr: "Rua Emilio Carraro N 945";
      nro: "945";
      xBairro: "Altos da Cidade";
      cMun: "3503406";
      xMun: "Arealva";
      CEP: "17160380";
      UF: "SP";
      fone?: "1432961608";
      email?: "wiptelecom@wiptelecom.net.br";
    };
  };

  /** Bloco do Destinatário (dest) */
  dest: {
    xNome: string;
    CPF?: string;
    CNPJ?: string;
    indIEDest: string;
    IE?: string;
    enderDest: {
      xLgr: string;
      nro: string;
      xBairro: string;
      cMun: string;
      xMun: string;
      CEP: string;
      UF: string;
      fone?: string;
      email?: string;
    };
  };

  /** Bloco Assinante (assinante) */
  assinante: {
    iCodAssinante: string;
    tpAssinante: string;
    tpServUtil: "1";
    NroTermPrinc?: string;
    cUFPrinc?: string;
    nContrato?: string;
    dContratoIni?: string;
    dContratoFim?: string;
  };

  /** Array de Detalhes de Produtos/Serviços (det) */
  det: Array<{
    nItem: string;
    prod: {
      cProd: string;
      xProd: string;
      cClass: string;
      CFOP?: string;
      uMed: string;
      qFaturada: string;
      vItem: string;
      vDesc?: string;
      vProd: string;
    };
    imposto: {
      indSemCST?: "1";
    };
  }>;

  /** Bloco de Valores Totais (total) */
  total: {
    vProd: string;
    ICMSTot: {
      vBC: string;
      vICMS: string;
      vICMSDeson: string;
      vFCP: string;
    };
    vCOFINS: string;
    vPIS: string;
    vFUNTTEL: string;
    vFUST: string;
    vRetTribTot: {
      vRetPIS: string;
      vRetCofins: string;
      vRetCSLL: string;
      vIRRF: string;
    };
    vDesc: string;
    vOutro: string;
    vNF: string;
  };

  /** Bloco de Faturamento (gFat) */
  gFat: {
    CompetFat: string;
    dVencFat: string;
    codBarras: string;
    dPerUsoIni?: string;
    dPerUsoFim?: string;
    codDebAuto?: string;
    codBanco?: string;
    codAgencia?: string;
  };

  /** Bloco de Responsável Técnico (gRespTec) */
  gRespTec?: {
    CNPJ: string;
    xContato: string;
    email: string;
    fone: string;
  };

  /** Bloco Suplementar (infNFComSupl) */
  infNFComSupl: {
    qrCodNFCom: string;
  };
}

class Nfcom {
  private homologacao: boolean = false;
  private WSDL_URL = "";
  private qrCodeUrl = "";
  private numeracao: number = 1;
  private serie: string =
    process.env.SERVIDOR_HOMOLOGACAO === "true" ? "99" : "3";

  private cleanString = (str: string) => {
    console.log(str);
    return str.replace(/\D/g, "");
  };

  public gerarNfcom = async (req: Request, res: Response): Promise<void> => {
    let { password, clientesSelecionados, service, reducao, ambiente } =
      req.body;

    if (ambiente === "homologacao") {
      this.homologacao = true;
      this.WSDL_URL =
        "https://nfcom-homologacao.svrs.rs.gov.br/WS/NFComRecepcao/NFComRecepcao.asmx";
    } else {
      this.homologacao = false;
      this.WSDL_URL =
        "https://nfcom.svrs.rs.gov.br/WS/NFComRecepcao/NFComRecepcao.asmx";
    }

    if (!reducao) reducao = 40;

    console.log(this.WSDL_URL);
    let reducaoStr = String(reducao);

    // 3. Agora você pode fazer a manipulação de string com segurança
    reducaoStr = reducaoStr.replace(",", ".").replace("%", "");

    reducao = Number(reducaoStr) / 100;

    // 1. Defina um array de Promises
    const promises = clientesSelecionados.map(async (item: any) => {
      // Repositórios não precisam ser criados a cada iteração, mas se for o padrão do seu ORM, mantenha.
      const ClientRepository = MkauthSource.getRepository(ClientesEntities);
      const FaturasRepository = MkauthSource.getRepository(Faturas);

      // Garante que o findOne seja feito por item.id (da requisição)
      const FaturasData = await FaturasRepository.findOne({
        where: { id: item },
      });

      // Verifica se a fatura foi encontrada antes de buscar o cliente
      if (!FaturasData || !FaturasData.login) {
        console.warn(`Fatura com ID ${item} não encontrada ou sem login.`);
        return null; // Retorna null para este item
      }

      const ClientData = await ClientRepository.findOne({
        where: { login: FaturasData.login, cpf_cnpj: Not(IsNull()) },
      });

      if (!ClientData) {
        console.warn(`Cliente com login ${FaturasData.login} não encontrado.`);
        return null;
      }

      // Helper para formatar data
      const formatDate = (date: Date) => {
        const offset = -3 * 60 * 60 * 1000;
        const localDate = new Date(date.getTime() + offset);
        return localDate.toISOString().slice(0, 19) + "-03:00";
      };

      const now = new Date();
      const dhEmi = formatDate(now);

      const value = parseFloat(FaturasData.valor) - ClientData.desconto;

      const vProd = (value * (1 - reducao)).toFixed(2);
      console.log(vProd);

      const vItem = vProd;
      const vNF = vProd;

      console.log(ClientData.login);
      console.log(ClientData.cpf_cnpj);
      // Limpeza de strings
      const cleanString = (str: string) => {
        console.log(str);
        return str.replace(/\D/g, "");
      };

      // Determina CNPJ ou CPF
      const docCliente = cleanString(ClientData.cpf_cnpj);
      const isCnpj = docCliente.length > 11;

      const lastNumber = await DataSource.getRepository(NFCom).findOne({
        where: {
          tpAmb: this.homologacao ? 2 : 1,
          serie: this.serie,
        },
        order: {
          numeracao: "DESC",
        },
      });

      console.log(lastNumber?.numeracao);

      const numeracao = (lastNumber?.numeracao || 0) + 1;

      this.numeracao = numeracao;

      // Construção do objeto NFCom
      const nfComData: INFComData = {
        ide: {
          cUF: "35",
          tpAmb: this.homologacao ? "2" : "1",
          mod: "62",
          serie: this.serie,
          nNF: String(numeracao),
          cNF: Math.floor(Math.random() * 9999999)
            .toString()
            .padStart(7, "0"),
          cDV: "0", // Será calculado
          dhEmi: dhEmi,
          tpEmis: "1",
          nSiteAutoriz: "0",
          cMunFG: "3503406",
          finNFCom: "0",
          tpFat: "0",
          verProc: "1",
        },
        emit: {
          CNPJ: process.env.CPF_CNPJ as string,
          IE: "183013286115",
          CRT: "1",
          xNome: "WIP TELECOM MULTIMIDIA EIRELI ME",
          xFant: "WIP TELECOM MULTIMIDIA EIRELI ME",
          enderEmit: {
            xLgr: "Rua Emilio Carraro N 945",
            nro: "945",
            xBairro: "Altos da Cidade",
            cMun: "3503406",
            xMun: "Arealva",
            CEP: "17160380",
            UF: "SP",
            fone: "1432961608",
            email: "wiptelecom@wiptelecom.net.br",
          },
        },
        dest: {
          xNome: ClientData.nome || "CLIENTE SEM NOME",
          ...(isCnpj ? { CNPJ: docCliente } : { CPF: docCliente }),
          indIEDest: "9",
          IE: ClientData.rg || "",
          enderDest: {
            xLgr: ClientData.endereco || "",
            nro: ClientData.numero || "S/N",
            xBairro: ClientData.bairro || "",
            cMun: ClientData.cidade_ibge || "3503406",
            xMun: ClientData.cidade || "",
            CEP: cleanString(ClientData.cep || ""),
            UF: ClientData.estado || "SP",
            fone: ClientData.celular
              ? cleanString(ClientData.celular)
              : undefined,
            email: ClientData.email || undefined,
          },
        },
        assinante: {
          iCodAssinante: ClientData.id.toString(),
          tpAssinante: "1",
          tpServUtil: "1",
          nContrato: ClientData.contrato || undefined,
          dContratoIni: ClientData.data_ins
            ? new Date(ClientData.data_ins).toISOString().slice(0, 10)
            : undefined,
        },
        det: [
          {
            nItem: "1",
            prod: {
              cProd: "001",
              xProd: "ASSINATURA INTERNET",
              cClass: "0100401",
              uMed: "1",
              qFaturada: "1",
              vItem: vItem,
              vProd: vProd,
            },
            imposto: {
              indSemCST: "1",
            },
          },
        ],
        total: {
          vProd: vProd,
          ICMSTot: {
            vBC: "0.00",
            vICMS: "0.00",
            vICMSDeson: "0.00",
            vFCP: "0.00",
          },
          vCOFINS: "0.00",
          vPIS: "0.00",
          vFUNTTEL: "0.00",
          vFUST: "0.00",
          vRetTribTot: {
            vRetPIS: "0.00",
            vRetCofins: "0.00",
            vRetCSLL: "0.00",
            vIRRF: "0.00",
          },
          vDesc: "0.00",
          vOutro: "0.00",
          vNF: vNF,
        },
        gFat: {
          CompetFat: FaturasData.datavenc
            ? new Date(FaturasData.datavenc)
                .toISOString()
                .slice(0, 7)
                .replace("-", "")
            : new Date().toISOString().slice(0, 7).replace("-", ""),
          dVencFat: FaturasData.datavenc
            ? new Date(FaturasData.datavenc).toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10),
          codBarras: cleanString(
            FaturasData.linhadig ||
              FaturasData.chave_gnet2 ||
              FaturasData.nossonum ||
              ""
          ),
        },
        infNFComSupl: {
          qrCodNFCom: "",
        },
      };

      // Calcular DV
      nfComData.ide.cDV = this.calcularDV(nfComData);

      return {
        nfComData,
        clientLogin: ClientData.login || "",
        faturaId: FaturasData.id,
      };
    });

    const resultados = await Promise.all(promises);

    // 4. Filtra resultados nulos e faz o type assertion
    const dadosFinaisNFCom = resultados.filter(
      (
        data
      ): data is {
        nfComData: INFComData;
        clientLogin: string;
        faturaId: number;
      } => data !== null
    );

    console.log(`Gerando ${dadosFinaisNFCom.length} notas...`);

    const responses: never[] = [];

    const job = DataSource.getRepository(Jobs).create({
      name: "Gerar Notas",
      description: "Notas Sendo Geradas em Segundo Plano",
      status: "pendente",
      total: dadosFinaisNFCom.length,
      processados: 0,
    });
    await DataSource.getRepository(Jobs).save(job);

    this.processarFilaBackground(dadosFinaisNFCom, job, password, responses);

    res.status(200).json("Notas Sendo Geradas em Segundo Plano!");
  };

  private async processarFilaBackground(
    dadosFinaisNFCom: any[],
    job: any,
    password: string,
    responses: any[]
  ) {
    for (const item of dadosFinaisNFCom) {
      try {
        await DataSource.getRepository(Jobs).update(job.id, {
          processados: job.processados + 1,
          total: job.total,
          status: "processando",
        });

        item.nfComData.ide.nNF = String(this.numeracao);
        item.nfComData.ide.serie = this.serie;
        item.nfComData.ide.cDV = this.calcularDV(item.nfComData);
        // 1. Recebe o objeto desestruturado
        const { soapEnvelope, xmlAssinado } = await this.gerarXml(
          item.nfComData,
          password
        );

        this.numeracao++;

        // Envia apenas o envelope SOAP
        const response = await this.enviarNfcom(soapEnvelope, password);
        console.log(response);

        let responseStr = response;
        if (typeof response !== "string") {
          responseStr = JSON.stringify(response);
        }

        const cStatMatch = responseStr.match(/<cStat>(\d+)<\/cStat>/);
        const xMotivoMatch = responseStr.match(/<xMotivo>(.*?)<\/xMotivo>/);

        const cStat = cStatMatch ? cStatMatch[1] : null;
        const xMotivo = xMotivoMatch ? xMotivoMatch[1] : "Erro desconhecido";

        if (cStat === "100") {
          console.log(
            `Nota ${item.nfComData.ide.nNF} autorizada! Montando XML Final...`
          );

          // 2. Extrai APENAS o bloco do Protocolo da resposta
          // Regex busca <protNFCom ...> até </protNFCom>
          const protMatch = responseStr.match(
            /<protNFCom[^>]*>[\s\S]*?<\/protNFCom>/
          );

          if (!protMatch) {
            throw new Error(
              "Nota autorizada, mas protocolo não encontrado na resposta."
            );
          }

          const protocoloXml = protMatch[0];

          // 3. Monta o XML de Distribuição (nfcomProc)
          // Padrão: <nfcomProc> <NFCom>...</NFCom> <protNFCom>...</protNFCom> </nfcomProc>
          const xmlFinalDistrib = `<?xml version="1.0" encoding="UTF-8"?><nfcomProc xmlns="http://www.portalfiscal.inf.br/nfcom" versao="1.00">${xmlAssinado}${protocoloXml}</nfcomProc>`;

          // 4. Passa o XML FINAL (String pura) para o banco
          await this.inserirDadosBanco(
            xmlFinalDistrib,
            item.nfComData,
            item.clientLogin,
            item.faturaId
          );

          responses.push({
            success: true,
            id: item.nfComData.ide.nNF,
            message: "NFCom autorizada com sucesso",
          });
        } else {
          // Erro na autorização da NFCom
          console.error(
            `Erro ao autorizar nota ${item.nfComData.ide.nNF}: ${cStat} - ${xMotivo}`
          );
          responses.push({
            success: false,
            error: true,
            id: item.nfComData.ide.nNF,
            clientLogin: item.clientLogin,
            cStat: cStat,
            message: xMotivo,
          });
        }
      } catch (e: any) {
        console.error(`Erro ao gerar nota ${item.nfComData.ide.nNF}:`, e);

        // Tratamento específico para erros de certificado
        let errorMessage = e.message;
        if (e.message && e.message.includes("mac verify failure")) {
          errorMessage =
            "Erro no certificado digital: Senha incorreta ou certificado inválido";
        }

        responses.push({
          success: false,
          error: true,
          id: item.nfComData.ide.nNF,
          clientLogin: item.clientLogin,
          message: errorMessage,
        });
      }
    }
    await DataSource.getRepository(Jobs).update(job.id, {
      status: "concluido",
      resultado: responses,
    });
  }

  private async inserirDadosBanco(
    xmlRetorno: string, // Agora recebe o XML Final (nfcomProc) em texto puro
    nfComData: INFComData,
    clientLogin: string,
    faturaId: number
  ): Promise<void> {
    try {
      const NFComRepository = DataSource.getRepository(NFCom);

      const xmlFinal = xmlRetorno;

      // Extração do Protocolo (para garantir que temos o dado)
      let protocolo = "";
      const matchProt = xmlFinal.match(/<nProt>(\d+)<\/nProt>/);
      if (matchProt) {
        protocolo = matchProt[1];
      }

      const novaNFCom = new NFCom();

      // Recalcula ou usa a chave existente
      const chaveAcesso = this.calcularChaveAcesso(nfComData);

      novaNFCom.numeracao = parseInt(nfComData.ide.nNF);
      novaNFCom.chave = chaveAcesso;
      novaNFCom.nNF = nfComData.ide.nNF;
      novaNFCom.serie = nfComData.ide.serie;

      // Salva o XML Completo (<nfcomProc>...</nfcomProc>)
      novaNFCom.xml = xmlFinal;

      novaNFCom.protocolo = protocolo;
      novaNFCom.status = protocolo ? "autorizada" : "pendente"; // Se chegou aqui com XML montado, é autorizada

      novaNFCom.data_emissao = new Date(nfComData.ide.dhEmi);
      novaNFCom.cliente_id =
        parseInt(nfComData.assinante.iCodAssinante || "0") || 0;

      novaNFCom.fatura_id = faturaId;
      novaNFCom.qrcodeLink = this.qrCodeUrl;
      novaNFCom.pppoe = clientLogin;
      novaNFCom.value = parseFloat(nfComData.total.vNF || "0") || 0;
      novaNFCom.tpAmb = this.homologacao ? 2 : 1;

      await NFComRepository.save(novaNFCom);
      console.log(`✅ NFCom ${novaNFCom.nNF} salva no banco com sucesso.`);
    } catch (error) {
      console.error("Erro no TypeORM ao salvar NFCom:", error);
      throw new Error("Falha ao salvar a NFCom no banco de dados.");
    }
  }

  private calcularChaveAcesso(nfComData: INFComData): string {
    const anoMes =
      nfComData.ide.dhEmi.substring(2, 4) + nfComData.ide.dhEmi.substring(5, 7);

    const chaveSemDV = `${
      nfComData.ide.cUF
    }${anoMes}${nfComData.emit.CNPJ.padStart(
      14,
      "0"
    )}62${nfComData.ide.serie.padStart(3, "0")}${nfComData.ide.nNF.padStart(
      9,
      "0"
    )}${nfComData.ide.tpEmis}${
      nfComData.ide.nSiteAutoriz || "0"
    }${nfComData.ide.cNF.padStart(7, "0")}`;

    return `${chaveSemDV}${nfComData.ide.cDV}`;
  }

  public async buscarNFCom(req: Request, res: Response) {
    try {
      const { searchParams } = req.body;
      console.log(searchParams);
      type NFComWhere = FindOptionsWhere<NFCom>;
      // 1. Inicia o objeto WHERE com os filtros obrigatórios
      const whereConditions: NFComWhere = {
        // Garante que 'titulo' (ID da fatura) seja tratado como número, se for o caso
        fatura_id: searchParams.titulo
          ? Number(searchParams.titulo)
          : undefined,
        pppoe: searchParams.pppoe || undefined, // Evita buscar por pppoe vazio se não fornecido
        tpAmb: searchParams.tpAmb || undefined,
        serie: searchParams.serie || undefined,
        status: searchParams.status || undefined,
      };

      console.log(whereConditions);

      // 2. Adiciona o filtro de data
      if (searchParams.dataInicio && searchParams.dataFim) {
        const dataInicio = new Date(`${searchParams.dataInicio}T00:00:00`);
        const dataFim = new Date(`${searchParams.dataFim}T23:59:59`);

        whereConditions.data_emissao = Between(dataInicio, dataFim);
      } else if (searchParams.data) {
        // Lógica CORRETA para buscar o dia inteiro, ignorando o problema do fuso

        // Define o início do dia no fuso horário local (ex: 2025-11-29T00:00:00 local)
        const dataStringLocalInicio = `${searchParams.data}T00:00:00`;
        const dataInicio = new Date(dataStringLocalInicio);

        // Define o limite superior como o INÍCIO do dia seguinte (ex: 2025-11-30T00:00:00 local)
        const dataFimLimite = new Date(dataInicio);
        dataFimLimite.setDate(dataFimLimite.getDate() + 1);
        // setHours(0, 0, 0, 0) não é necessário aqui, pois já está no início do dia.

        // Adiciona a condição BETWEEN usando o formato ISO string (recomendado pelo TypeORM)
        // WHERE data_emissao >= dataInicio AND data_emissao < dataFimLimite
        whereConditions.data_emissao = Between(
          dataInicio, // Type Date (correto!)
          dataFimLimite // Type Date (correto!)
        );
      }

      // 3. Executa a busca com as condições montadas
      const NFComRepository = DataSource.getRepository(NFCom);
      const nfcom = await NFComRepository.find({
        where: whereConditions,
      });

      // Se precisar de mais detalhes, considere adicionar .relations, .order, etc.

      res.status(200).json(nfcom);
    } catch (error) {
      console.error("Erro ao buscar NFCom:", error);
      res.status(500).json({ error: "Erro ao buscar NFCom" });
    }
  }

  private cleanXml(xml: string): string {
    return xml
      .replace(/>\s+</g, "><") // Remove espaços entre tags
      .replace(/\s+xmlns/g, " xmlns") // Garante espaço único antes de xmlns (opcional, segurança)
      .trim(); // Remove espaços do início e fim
  }

  public criarXMLCancelamento(
    chaveNFCom: string,
    protocoloAutorizacao: string,
    cnpjEmitente: string,
    justificativa: string,
    tpAmb: number
  ) {
    // 1. Definições
    const tpEvento = "110111";
    const nSeqEvento = "001";
    const dataObj = new Date();

    dataObj.setMinutes(dataObj.getMinutes() - 2);

    dataObj.setHours(dataObj.getHours() - 3);

    const dataHora = dataObj.toISOString().replace(/\.\d{3}Z$/, "") + "-03:00";
    const codigoUF = "35";

    // 2. ID (Fundamental para a assinatura)
    const idEvento = `ID${tpEvento}${chaveNFCom}${nSeqEvento}`;

    // 3. Criação do Documento - Raiz agora é 'eventoNFCom'
    const doc = create({ version: "1.0", encoding: "UTF-8" });

    // A raiz é definida diretamente pelo tipo TEvento do XSD
    const eventoNFCom = doc.ele("eventoNFCom", {
      xmlns: "http://www.portalfiscal.inf.br/nfcom",
      versao: "1.00",
    });

    // 4. infEvento (O alvo da assinatura)
    const infEvento = eventoNFCom.ele("infEvento", { Id: idEvento });

    infEvento.ele("cOrgao").txt(codigoUF);
    infEvento.ele("tpAmb").txt(String(tpAmb)); // 1=Prod, 2=Homolog
    infEvento.ele("CNPJ").txt(cnpjEmitente);
    infEvento.ele("chNFCom").txt(chaveNFCom);
    infEvento.ele("dhEvento").txt(dataHora);
    infEvento.ele("tpEvento").txt(tpEvento);
    infEvento.ele("nSeqEvento").txt("1"); // Verifique se SEFAZ pede com ou sem zero à esquerda aqui. O XSD diz pattern [0-9]{1,3}, então '1' é válido.

    // 5. detEvento (Obrigatório segundo XSD)
    const detEvento = infEvento.ele("detEvento", { versaoEvento: "1.00" });

    // 6. Dados específicos do Cancelamento
    const evCancNFCom = detEvento.ele("evCancNFCom");

    evCancNFCom.ele("descEvento").txt("Cancelamento");
    evCancNFCom.ele("nProt").txt(protocoloAutorizacao);
    evCancNFCom.ele("xJust").txt(justificativa);

    // Retorna string para assinatura
    return doc.end({ headless: true });
  }

  public cancelarNFcom = async (req: Request, res: Response) => {
    try {
      const { nNF, pppoe, password, tpAmb } = req.body;
      const NFComRepository = DataSource.getRepository(NFCom);

      const nfcom = await NFComRepository.findOne({
        where: {
          nNF,
          pppoe,
        },
      });
      if (!nfcom) {
        res.status(404).json({ error: "NFCom não encontrada" });
        return;
      }

      if (tpAmb === 2) {
        this.homologacao = true;
        this.WSDL_URL =
          "https://nfcom-homologacao.svrs.rs.gov.br/WS/NFComRecepcao/NFComRecepcao.asmx";
      } else {
        this.homologacao = false;
        this.WSDL_URL =
          "https://nfcom.svrs.rs.gov.br/WS/NFComRecepcao/NFComRecepcao.asmx";
      }

      const xmlCancelamento = this.criarXMLCancelamento(
        nfcom.chave,
        nfcom.protocolo,
        process.env.CPF_CNPJ as string,
        "Cancelamento por erro de cadastro",
        nfcom.tpAmb
      );

      const assinado = this.assinarXmlCancelamento(
        xmlCancelamento,
        `evCancNFCom${nNF}`,
        password
      );

      const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
      <soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
          <soap12:Body>
              <nfcomDadosMsg xmlns="http://www.portalfiscal.inf.br/nfcom/wsdl/NFComRecepcaoEvento">
                  ${assinado}
              </nfcomDadosMsg>
          </soap12:Body>
      </soap12:Envelope>`;

      const xmlBodyToSend = this.cleanXml(soapEnvelope);

      console.log(xmlBodyToSend);

      const urlEnvio = this.homologacao
        ? "https://nfcom-homologacao.svrs.rs.gov.br/WS/NFComRecepcaoEvento/NFComRecepcaoEvento.asmx"
        : "https://nfcom.svrs.rs.gov.br/WS/NFComRecepcaoEvento/NFComRecepcaoEvento.asmx";

      console.log(urlEnvio);

      const certPath = path.join(__dirname, "..", "files", "certificado.pfx");

      if (!fs.existsSync(certPath)) {
        throw new Error(`Certificado não encontrado em: ${certPath}`);
      }

      const tempDir = path.join(__dirname, "..", "temp");
      const processedCertPath = processarCertificado(
        certPath,
        password,
        tempDir
      );

      const pfxBuffer = fs.readFileSync(processedCertPath);

      const httpsAgent = new https.Agent({
        pfx: pfxBuffer,
        passphrase: password,
        rejectUnauthorized: false,
      });

      const response = await axios.post(urlEnvio, xmlBodyToSend, {
        httpsAgent,
        headers: {
          // Action minúscula conforme WSDL
          "Content-Type":
            'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfcom/wsdl/NFComRecepcaoEvento/nfcomRecepcaoEvento"',
        },
      });

      const xmlResponse = response.data;

      const cStatMatch = xmlResponse.match(/<cStat>(\d+)<\/cStat>/);
      const xMotivoMatch = xmlResponse.match(/<xMotivo>(.*?)<\/xMotivo>/);

      const cStat = cStatMatch ? cStatMatch[1] : null;
      const xMotivo = xMotivoMatch ? xMotivoMatch[1] : "Erro desconhecido";

      console.log(xmlResponse);

      if (cStat === "135") {
        console.log(`Nota ${nNF} cancelada!`);

        const nfcom = await NFComRepository.findOne({
          where: {
            nNF,
            pppoe,
          },
        });
        if (!nfcom) {
          res.status(404).json({ error: "NFCom não encontrada" });
          return;
        }
        nfcom.status = "cancelada";
        await NFComRepository.save(nfcom);
        res.status(200).json(nfcom);
        return;
      } else {
        console.log(`Erro ao cancelar nota ${nNF}: ${cStat} - ${xMotivo}`);
        res.status(500).json({
          cStat,
          xMotivo,
        });
        return;
      }
    } catch (error) {
      console.error("Erro ao cancelar NFCom:", error);
      res.status(500).json({ error: "Erro ao cancelar NFCom" });
      return;
    }
  };

  public async BuscarClientes(req: Request, res: Response) {
    const { cpf, filters, dateFilter } = req.body;
    const ClientRepository = MkauthSource.getRepository(ClientesEntities);
    const w: any = {};
    let servicosFilter: string[] = ["mensalidade"];
    if (cpf) w.cpf_cnpj = cpf;
    if (filters) {
      let { plano, vencimento, cli_ativado, SVA, servicos } = filters;
      if (plano?.length) w.plano = In(plano);
      if (vencimento?.length) w.venc = In(vencimento);
      if (cli_ativado?.length) w.cli_ativado = In(["s"]);
      if (SVA?.length) {
        w.vendedor = In(SVA);
      } else {
        w.vendedor = In(["SCM"]);
      }
      if (servicos?.length) servicosFilter = servicos;
    }
    try {
      const clientesResponse = await ClientRepository.find({
        where: w,
        select: {
          login: true,
          cpf_cnpj: true,
          cli_ativado: true,
          desconto: true,
        },
        order: { id: "DESC" },
      });
      const faturasData = MkauthSource.getRepository(Faturas);
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const startDate = dateFilter
        ? new Date(dateFilter.start)
        : firstDayOfMonth;
      const endDate = dateFilter ? new Date(dateFilter.end) : lastDayOfMonth;
      startDate.setHours(startDate.getHours() + 3);
      endDate.setHours(endDate.getHours() + 3);
      const faturasResponse = await faturasData.find({
        where: {
          login: In(clientesResponse.map((c) => c.login)),
          datavenc: Between(startDate, endDate),
          datadel: IsNull(),
          tipo: In(servicosFilter),
        },
        select: {
          id: true,
          login: true,
          datavenc: true,
          tipo: true,
          valor: true,
        },
        order: { id: "DESC" },
      });
      const arr = clientesResponse
        .map((cliente) => {
          const fat = faturasResponse.filter((f) => f.login === cliente.login);
          if (!fat.length) return null;
          return {
            ...cliente,
            fatura: {
              titulo: fat.map((f) => f.id).join(", ") || null,
              login: fat.map((f) => f.login).join(", ") || null,
              datavenc:
                fat
                  .map((f) => new Date(f.datavenc).toLocaleDateString("pt-BR"))
                  .join(", ") || null,
              tipo: fat.map((f) => f.tipo).join(", ") || null,
              valor:
                fat
                  .map((f) =>
                    (Number(f.valor) - (cliente.desconto || 0)).toFixed(2)
                  )
                  .join(", ") || null,
            },
          };
        })
        .filter((i): i is NonNullable<typeof i> => i !== null)
        .sort((a, b) =>
          (b?.fatura?.titulo || "").localeCompare(a?.fatura?.titulo || "")
        );
      res.status(200).json(arr);
    } catch {
      res.status(500).json({ message: "Erro ao buscar clientes" });
    }
  }

  private calcularDV(data: INFComData): string {
    const chaveSemDV = `${data.ide.cUF}${data.ide.dhEmi.substring(
      2,
      4
    )}${data.ide.dhEmi.substring(5, 7)}${data.emit.CNPJ.padStart(
      14,
      "0"
    )}62${data.ide.serie.padStart(3, "0")}${data.ide.nNF.padStart(9, "0")}${
      data.ide.tpEmis
    }${data.ide.nSiteAutoriz || "0"}${data.ide.cNF.padStart(7, "0")}`;

    let soma = 0;
    let peso = 2;
    for (let i = chaveSemDV.length - 1; i >= 0; i--) {
      soma += parseInt(chaveSemDV[i]) * peso;
      peso++;
      if (peso > 9) peso = 2;
    }

    const resto = soma % 11;
    const dv = resto < 2 ? 0 : 11 - resto;
    return dv.toString();
  }

  // public gerarNfcomWit(data: INFComData, password: string): string {
  //   const xml = this.gerarXml(data);
  //   return xml;
  // }

  public compactarXML(xmlString: string): string {
    let cleanXml = xmlString;

    // 1. Remove BOM (Byte Order Mark) se existir
    if (cleanXml.charCodeAt(0) === 0xfeff) {
      cleanXml = cleanXml.slice(1);
    }

    // 2. Remove declaração XML (<?xml...?>) se existir
    // A SEFAZ espera que o GZIP comece direto com a tag raiz
    cleanXml = cleanXml.replace(/^\s*<\?xml[^>]*\?>/i, "");

    // 3. ATENÇÃO: Removi o replace(/>\s+</g, "><") daqui.
    // A limpeza de espaços deve ser feita ANTES de assinar.
    // Se fizer depois, quebra o hash da assinatura (Erro 297).
    cleanXml = cleanXml.trim();

    // 4. Compactação
    const buffer = Buffer.from(cleanXml, "utf-8");
    const compressedBuffer = gzipSync(buffer);

    console.log(
      "Magic Bytes (GZIP Check - deve começar com 1f8b):",
      compressedBuffer.toString("hex").substring(0, 4)
    );

    return compressedBuffer.toString("base64");
  }

  public async enviarNfcom(xml: string, password: string): Promise<any> {
    try {
      const certPath = path.join(__dirname, "..", "files", "certificado.pfx");

      if (!fs.existsSync(certPath)) {
        throw new Error(`Certificado não encontrado em: ${certPath}`);
      }

      const tempDir = path.join(__dirname, "..", "temp");
      const processedCertPath = processarCertificado(
        certPath,
        password,
        tempDir
      );

      const pfxBuffer = fs.readFileSync(processedCertPath);

      const httpsAgent = new https.Agent({
        pfx: pfxBuffer,
        passphrase: password,
        rejectUnauthorized: false,
      });

      // URL sem ?wsdl para evitar erro 244/500
      const urlEnvio = this.WSDL_URL;

      console.log("Enviando para:", urlEnvio);

      const response = await axios.post(urlEnvio, xml, {
        httpsAgent,
        headers: {
          // Action minúscula conforme WSDL
          "Content-Type":
            'application/soap+xml; charset=utf-8; action="http://www.portalfiscal.inf.br/nfcom/wsdl/NFComRecepcao/nfcomRecepcao"',
        },
      });
      return response.data;
    } catch (error) {
      console.error("Erro ao enviar NFCom:", error);
      throw error;
    }
  }

  public async gerarXml(
    data: INFComData,
    password: string
  ): Promise<{ soapEnvelope: string; xmlAssinado: string }> {
    // 1. Gera Chave de Acesso
    const anoMes =
      data.ide.dhEmi.substring(2, 4) + data.ide.dhEmi.substring(5, 7);

    let chaveSemDV = `${data.ide.cUF}${anoMes}${data.emit.CNPJ.padStart(
      14,
      "0"
    )}62${data.ide.serie.padStart(3, "0")}${data.ide.nNF.padStart(9, "0")}${
      data.ide.tpEmis
    }${data.ide.nSiteAutoriz || "0"}${data.ide.cNF.padStart(7, "0")}`;

    const chaveAcessoCompleta = `${chaveSemDV}${data.ide.cDV}`;

    if (chaveAcessoCompleta.length !== 44) {
      throw new Error(
        `Chave de acesso gerada tem tamanho inválido: ${chaveAcessoCompleta.length} (esperado 44). Verifique cNF e nSiteAutoriz.`
      );
    }

    const qrCodeContent = `https://dfe-portal.svrs.rs.gov.br/NFCom/QRCode?chNFCom=${chaveAcessoCompleta}&tpAmb=${
      this.homologacao ? "2" : "1"
    }`;
    this.qrCodeUrl = qrCodeContent;

    const id = `NFCom${chaveAcessoCompleta}`;

    // 2. Gera XML Interno
    const docInterno = create({ version: "1.0", encoding: "UTF-8" });

    // Namespace 'nfcom' minúsculo na tag raiz
    const nfCom = docInterno.ele("NFCom", {
      xmlns: "http://www.portalfiscal.inf.br/nfcom",
    });

    const infNFCom = nfCom.ele("infNFCom", {
      versao: "1.00",
      Id: id,
    });

    // --- Preenchimento dos dados ---
    const ide = infNFCom.ele("ide");
    ide.ele("cUF").txt(data.ide.cUF);
    ide.ele("tpAmb").txt(data.ide.tpAmb);
    ide.ele("mod").txt(data.ide.mod);
    ide.ele("serie").txt(data.ide.serie);
    ide.ele("nNF").txt(data.ide.nNF);

    ide.ele("cNF").txt(data.ide.cNF);
    ide.ele("cDV").txt(data.ide.cDV);
    ide.ele("dhEmi").txt(data.ide.dhEmi);
    ide.ele("tpEmis").txt(data.ide.tpEmis);
    ide.ele("nSiteAutoriz").txt(data.ide.nSiteAutoriz);
    ide.ele("cMunFG").txt(data.ide.cMunFG);
    ide.ele("finNFCom").txt(data.ide.finNFCom);
    ide.ele("tpFat").txt(data.ide.tpFat);
    ide.ele("verProc").txt(data.ide.verProc);

    const emit = infNFCom.ele("emit");
    emit.ele("CNPJ").txt(data.emit.CNPJ);
    emit.ele("IE").txt(data.emit.IE);
    emit.ele("CRT").txt(data.emit.CRT);
    emit.ele("xNome").txt(data.emit.xNome);
    emit.ele("xFant").txt(data.emit.xFant);
    const enderEmit = emit.ele("enderEmit");
    enderEmit.ele("xLgr").txt(data.emit.enderEmit.xLgr);
    enderEmit.ele("nro").txt(data.emit.enderEmit.nro);
    enderEmit.ele("xBairro").txt(data.emit.enderEmit.xBairro);
    enderEmit.ele("cMun").txt(data.emit.enderEmit.cMun);
    enderEmit.ele("xMun").txt(data.emit.enderEmit.xMun);
    enderEmit.ele("CEP").txt(data.emit.enderEmit.CEP);
    enderEmit.ele("UF").txt(data.emit.enderEmit.UF);

    const dest = infNFCom.ele("dest");
    dest.ele("xNome").txt(data.dest.xNome.trim());
    if (data.dest.CPF) dest.ele("CPF").txt(data.dest.CPF.trim());
    if (data.dest.CNPJ) dest.ele("CNPJ").txt(data.dest.CNPJ.trim());
    // 1. Definição inicial (Provisória)
    data.dest.indIEDest = data.dest.CPF ? "9" : "1";

    // 2. Limpeza da IE (Saneamento)
    if (data.dest.IE) {
      data.dest.IE = this.cleanString(data.dest.IE);
    }

    // 3. LÓGICA DE CORREÇÃO (Onde corrigimos o erro 426)
    // Se o sistema marcou como '1', mas a IE está vazia/nula, força ser '9'
    if (
      data.dest.indIEDest === "1" &&
      (!data.dest.IE || data.dest.IE.length === 0)
    ) {
      data.dest.indIEDest = "9";
    }

    // 4. Regras de Valor da IE baseadas no indicador final
    if (data.dest.indIEDest === "2") {
      data.dest.IE = "ISENTO";
    } else if (data.dest.indIEDest === "9") {
      delete data.dest.IE;
    }

    // 5. GERAÇÃO DO XML (Só escreve agora que o valor é definitivo)
    dest.ele("indIEDest").txt(data.dest.indIEDest);

    if (data.dest.IE) {
      dest.ele("IE").txt(data.dest.IE);
    }

    const enderDest = dest.ele("enderDest");
    enderDest.ele("xLgr").txt(data.dest.enderDest.xLgr.trim());
    enderDest.ele("nro").txt(data.dest.enderDest.nro.trim());
    enderDest.ele("xBairro").txt(data.dest.enderDest.xBairro.trim());
    enderDest.ele("cMun").txt(data.dest.enderDest.cMun.trim());
    enderDest.ele("xMun").txt(data.dest.enderDest.xMun.trim());
    enderDest.ele("CEP").txt(data.dest.enderDest.CEP.trim());
    enderDest.ele("UF").txt(data.dest.enderDest.UF.trim());

    const assinante = infNFCom.ele("assinante");
    assinante.ele("iCodAssinante").txt(data.assinante.iCodAssinante);
    assinante.ele("tpAssinante").txt(data.assinante.tpAssinante);
    assinante.ele("tpServUtil").txt(data.assinante.tpServUtil);
    if (data.assinante.NroTermPrinc) {
      assinante.ele("NroTermPrinc").txt(data.assinante.NroTermPrinc);
    }
    if (data.assinante.cUFPrinc) {
      assinante.ele("cUFPrinc").txt(data.assinante.cUFPrinc);
    }
    if (data.assinante.nContrato) {
      assinante.ele("nContrato").txt(data.assinante.nContrato);
    }
    if (data.assinante.dContratoIni) {
      assinante.ele("dContratoIni").txt(data.assinante.dContratoIni);
    }
    if (data.assinante.dContratoFim) {
      assinante.ele("dContratoFim").txt(data.assinante.dContratoFim);
    }

    data.det.forEach((item) => {
      const det = infNFCom.ele("det", { nItem: item.nItem });
      const prod = det.ele("prod");
      prod.ele("cProd").txt(item.prod.cProd);
      prod.ele("xProd").txt(item.prod.xProd);
      prod.ele("cClass").txt(item.prod.cClass);
      if (item.prod.CFOP) prod.ele("CFOP").txt(item.prod.CFOP);
      prod.ele("uMed").txt(item.prod.uMed);
      prod.ele("qFaturada").txt(item.prod.qFaturada);
      prod.ele("vItem").txt(item.prod.vItem);
      prod.ele("vProd").txt(item.prod.vProd);
      const imposto = det.ele("imposto");
      imposto.ele("indSemCST").txt(item.imposto.indSemCST as string);
    });

    const total = infNFCom.ele("total");
    total.ele("vProd").txt(data.total.vProd);
    const icmsTot = total.ele("ICMSTot");
    icmsTot.ele("vBC").txt(data.total.ICMSTot.vBC);
    icmsTot.ele("vICMS").txt(data.total.ICMSTot.vICMS);
    icmsTot.ele("vICMSDeson").txt(data.total.ICMSTot.vICMSDeson);
    icmsTot.ele("vFCP").txt(data.total.ICMSTot.vFCP);
    total.ele("vCOFINS").txt(data.total.vCOFINS);
    total.ele("vPIS").txt(data.total.vPIS);
    total.ele("vFUNTTEL").txt(data.total.vFUNTTEL);
    total.ele("vFUST").txt(data.total.vFUST);
    const vRetTribTot = total.ele("vRetTribTot");
    vRetTribTot.ele("vRetPIS").txt(data.total.vRetTribTot.vRetPIS);
    vRetTribTot.ele("vRetCofins").txt(data.total.vRetTribTot.vRetCofins);
    vRetTribTot.ele("vRetCSLL").txt(data.total.vRetTribTot.vRetCSLL);
    vRetTribTot.ele("vIRRF").txt(data.total.vRetTribTot.vIRRF);
    total.ele("vDesc").txt(data.total.vDesc);
    total.ele("vOutro").txt(data.total.vOutro);
    total.ele("vNF").txt(data.total.vNF);

    const gFat = infNFCom.ele("gFat");
    gFat.ele("CompetFat").txt(data.gFat.CompetFat);
    gFat.ele("dVencFat").txt(data.gFat.dVencFat);
    gFat.ele("codBarras").txt(data.gFat.codBarras);

    const infNFComSupl = nfCom.ele("infNFComSupl");
    // CDATA no QR Code
    infNFComSupl.ele("qrCodNFCom").dat(qrCodeContent);

    // 3. Serializa sem formatação (headless) para assinar
    // O 'headless: true' remove o <?xml ...?>
    const xmlInternoSemAssinatura = docInterno.end({
      prettyPrint: false,
      headless: true,
    });

    // 4. Assina (Passando o ID para o campo URI)
    let xmlInternoAssinado: string;
    try {
      xmlInternoAssinado = this.assinarXml(
        xmlInternoSemAssinatura,
        id,
        password
      );
    } catch (error) {
      console.error("Erro ao assinar XML:", error);
      xmlInternoAssinado = xmlInternoSemAssinatura;
    }

    console.log(xmlInternoAssinado);

    // 5. Compacta GZIP
    const xmlComprimidoBase64 = this.compactarXML(xmlInternoAssinado);

    console.log(
      "Base64 gerado (inicio):",
      xmlComprimidoBase64.substring(0, 50)
    );

    // 6. Montagem MANUAL do Envelope SOAP (A alteração solicitada)
    // Isso garante que o namespace esteja correto e o Base64 não seja alterado
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
    <soap12:Body>
        <nfcomDadosMsg xmlns="http://www.portalfiscal.inf.br/nfcom/wsdl/NFComRecepcao">
            ${xmlComprimidoBase64}
        </nfcomDadosMsg>
    </soap12:Body>
</soap12:Envelope>`;

    return { soapEnvelope, xmlAssinado: xmlInternoAssinado };
  }

  private assinarXml(xml: string, idTag: string, password: string): string {
    const certPath = path.join(__dirname, "..", "files", "certificado.pfx");

    if (!fs.existsSync(certPath)) {
      throw new Error(`Certificado não encontrado em: ${certPath}`);
    }

    const pfxBuffer = fs.readFileSync(certPath);
    const pfxAsn1 = forge.asn1.fromDer(
      forge.util.createBuffer(pfxBuffer.toString("binary"))
    );
    const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, password);

    const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag })[
      forge.pki.oids.certBag
    ];
    const keyBags = pfx.getBags({
      bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
    })[forge.pki.oids.pkcs8ShroudedKeyBag];

    if (!certBags || !keyBags) {
      throw new Error(
        "Não foi possível extrair certificado ou chave privada do PFX."
      );
    }

    const certPem = forge.pki.certificateToPem(certBags[0]!.cert!);
    const keyPem = forge.pki.privateKeyToPem(keyBags[0]!.key!);

    const signer = new SignedXml();
    signer.privateKey = keyPem;
    signer.publicCert = certPem;

    signer.canonicalizationAlgorithm =
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
    signer.signatureAlgorithm = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";

    signer.addReference({
      xpath: "//*[local-name(.)='infNFCom']",
      transforms: [
        "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
        "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
      ],
      digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
      uri: "#" + idTag,
    });

    signer.computeSignature(xml, {
      location: {
        reference: "//*[local-name(.)='infNFComSupl']",
        action: "after",
      },
    });

    return signer.getSignedXml();
  }

  private assinarXmlCancelamento(
    xml: string,
    idTag: string,
    password: string
  ): string {
    const certPath = path.join(__dirname, "..", "files", "certificado.pfx");

    if (!fs.existsSync(certPath)) {
      throw new Error(`Certificado não encontrado em: ${certPath}`);
    }

    const pfxBuffer = fs.readFileSync(certPath);
    const pfxAsn1 = forge.asn1.fromDer(
      forge.util.createBuffer(pfxBuffer.toString("binary"))
    );
    const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, false, password);

    const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag })[
      forge.pki.oids.certBag
    ];
    const keyBags = pfx.getBags({
      bagType: forge.pki.oids.pkcs8ShroudedKeyBag,
    })[forge.pki.oids.pkcs8ShroudedKeyBag];

    if (!certBags || !keyBags) {
      throw new Error(
        "Não foi possível extrair certificado ou chave privada do PFX."
      );
    }

    const certPem = forge.pki.certificateToPem(certBags[0]!.cert!);
    const keyPem = forge.pki.privateKeyToPem(keyBags[0]!.key!);

    const signer = new SignedXml();
    signer.privateKey = keyPem;
    signer.publicCert = certPem;

    signer.canonicalizationAlgorithm =
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
    signer.signatureAlgorithm = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";

    signer.addReference({
      xpath: "//*[local-name(.)='infEvento']",
      transforms: [
        "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
        "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
      ],
      digestAlgorithm: "http://www.w3.org/2000/09/xmldsig#sha1",
      uri: "#" + idTag,
    });

    signer.computeSignature(xml, {
      location: {
        reference: "//*[local-name(.)='infEvento']",
        action: "after",
      },
    });

    return signer.getSignedXml();
  }
}

export default Nfcom;
