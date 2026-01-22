import { create } from "xmlbuilder2";
import { XMLParser } from "fast-xml-parser";
import QRCode from "qrcode";
import bwipjs from "bwip-js";
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
import PDFDocument from "pdfkit";
import dotenv from "dotenv";
import JSZip from "jszip";
import DataSource from "../database/DataSource";
import {
  Between,
  FindOptionsWhere,
  In,
  IsNull,
  Not,
  Repository,
} from "typeorm";
import { isNotEmpty } from "class-validator";
import { Jobs } from "../entities/Jobs";
import AppDataSource from "../database/MkauthSource";
import Email from "./Email";
dotenv.config();

interface CertificadoDados {
  nomeEmpresa: string;
  cnpj: string;
  numeroSerie: string;
  dataInicio: string;
  dataFim: string;
  emissor: string;
}

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
    process.env.SERVIDOR_HOMOLOGACAO === "true" ? "99" : "4";

  private cleanString = (str: string) => {
    console.log(str);
    return str.replace(/\D/g, "");
  };

  public gerarNfcom = async (req: Request, res: Response): Promise<void> => {
    let { password, clientesSelecionados, reducao, ambiente, lastNfcomId } =
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

      const value = Number(FaturasData.valor) - ClientData.desconto;
      console.log(value);

      const vProd = (value * (1 - reducao)).toFixed(2);
      console.log(vProd);
      console.log(reducao);

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

      const lastRecord = await DataSource.getRepository(NFCom).findOne({
        where: {
          tpAmb: this.homologacao ? 2 : 1,
          serie: this.serie,
        },
        order: {
          numeracao: "DESC", // Garante que pega o maior número
        },
      });

      const currentMaxNumber = lastNfcomId
        ? Number(lastNfcomId)
        : lastRecord
          ? Number(lastRecord.numeracao)
          : 0;

      const nextNumber = currentMaxNumber + 1;

      console.log(nextNumber);

      const numeracao = nextNumber;

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
              xProd: ClientData.plano || "",
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
              "",
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
        clientType: ClientData.vendedor || "",
        cpf_cnpj: ClientData.cpf_cnpj || "",
      };
    });

    const resultados = await Promise.all(promises);

    // 4. Filtra resultados nulos e faz o type assertion
    const dadosFinaisNFCom = resultados.filter(
      (
        data,
      ): data is {
        nfComData: INFComData;
        clientLogin: string;
        faturaId: number;
        clientType: string;
        cpf_cnpj: string;
      } => data !== null,
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

    res.status(200).json({
      message: "Notas Sendo Geradas em Segundo Plano!",
      job: job.id,
    });
  };

  public baixarZipXml = async (req: Request, res: Response) => {
    try {
      const { id } = req.body;

      // Busca as notas
      const nfcoms = await DataSource.getRepository(NFCom).find({
        where: { id: In(id) },
      });

      if (!nfcoms.length) {
        res.status(404).json({ message: "Nenhuma nota encontrada." });
        return;
      }

      console.log(id);

      const zip = new JSZip();
      const folderXml = zip.folder("xmls");
      const folderPdf = zip.folder("pdfs");

      // Processa em paralelo para ser mais rápido
      await Promise.all(
        nfcoms.map(async (nfcom) => {
          const nomeArquivo =
            nfcom.numeracao || nfcom.nNF || `nota_${nfcom.id}`;

          // 1. Adiciona o XML
          if (nfcom.xml) {
            folderXml?.file(`${nomeArquivo}.xml`, nfcom.xml);
          }

          // 2. Gera e Adiciona o PDF
          try {
            // Passe uma observação padrão ou pegue do banco se tiver
            const obs = await this.getNfcomByChaveDeOlhoNoImposto();
            const pdfBuffer = await this.generateXmlPdf(nfcom, obs.Chave);

            folderPdf?.file(`${nomeArquivo}.pdf`, pdfBuffer);
          } catch (err) {
            console.error(`Erro ao gerar PDF da nota ${nomeArquivo}:`, err);
            folderPdf?.file(
              `ERRO_${nomeArquivo}.txt`,
              `Falha ao gerar PDF: ${err}`,
            );
          }
        }),
      );

      // Gera o binário do ZIP
      const zipContent = await zip.generateAsync({ type: "nodebuffer" });

      // Envia resposta
      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=notas_fiscais.zip",
      );

      console.log(zipContent);

      res.send(zipContent);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Erro ao processar download em lote." });
    }
  };

  public async getNfcomByChaveDeOlhoNoImposto(req?: Request, res?: Response) {
    const response = await axios.get(
      `https://apidoni.ibpt.org.br/api/v1/servicos?token=${process.env.OLHO_NO_IMPOSTO_TOKEN}&cnpj=${process.env.OLHO_NO_IMPOSTO_CNPJ}&codigo=${process.env.OLHO_NO_IMPOSTO_CODIGO}&uf=${process.env.OLHO_NO_IMPOSTO_UF}&descricao=${process.env.OLHO_NO_IMPOSTO_DESCRICAO}&unidadeMedida=${process.env.OLHO_NO_IMPOSTO_UNIDADEMEDIDA}&valor=${process.env.OLHO_NO_IMPOSTO_VALOR}`,
    );

    if (req || res) {
      res?.status(200).json(response.data);
    } else {
      return response.data;
    }
  }

  private async processarFilaBackground(
    dadosFinaisNFCom: any[],
    job: any,
    password: string,
    responses: any[],
  ) {
    let contadorProcessados = job.processados || 0;

    for (const item of dadosFinaisNFCom) {
      try {
        contadorProcessados++;

        await DataSource.getRepository(Jobs).update(job.id, {
          processados: contadorProcessados,
          total: job.total,
          status: "processando",
        });

        item.nfComData.ide.nNF = String(this.numeracao);
        item.nfComData.ide.serie = this.serie;
        item.nfComData.ide.cDV = this.calcularDV(item.nfComData);
        // 1. Recebe o objeto desestruturado
        const { soapEnvelope, xmlAssinado } = await this.gerarXml(
          item.nfComData,
          password,
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
            `Nota ${item.nfComData.ide.nNF} autorizada! Montando XML Final...`,
          );

          // 2. Extrai APENAS o bloco do Protocolo da resposta
          // Regex busca <protNFCom ...> até </protNFCom>
          const protMatch = responseStr.match(
            /<protNFCom[^>]*>[\s\S]*?<\/protNFCom>/,
          );

          if (!protMatch) {
            throw new Error(
              "Nota autorizada, mas protocolo não encontrado na resposta.",
            );
          }

          const protocoloXml = protMatch[0];

          // 3. Monta o XML de Distribuição (nfcomProc)
          // Padrão: <nfcomProc> <NFCom>...</NFCom> <protNFCom>...</protNFCom> </nfcomProc>
          const xmlFinalDistrib = `<?xml version="1.0" encoding="UTF-8"?><nfcomProc xmlns="http://www.portalfiscal.inf.br/nfcom" versao="1.00">${xmlAssinado}${protocoloXml}</nfcomProc>`;

          // 4. Passa o XML FINAL (String pura) para o banco
          const savedNfcom = await this.inserirDadosBanco(
            xmlFinalDistrib,
            item.nfComData,
            item.clientLogin,
            item.faturaId,
            item.clientType,
            item.cpf_cnpj,
          );

          // --- ENVIO DE EMAIL COM PDF ---
          try {
            let emailDestino = item.nfComData.dest.email;

            // Se for homologação, troca o email
            if (this.homologacao) {
              emailDestino = "suporte_wiptelecom@outlook.com";
            }

            if (emailDestino) {
              // 1. Pega dados para montar o PDF (obs/Chave)
              const obsData: any = await this.getNfcomByChaveDeOlhoNoImposto();
              const obsString = obsData?.Chave || "";

              // 2. Gera o PDF em memória (Buffer)
              const pdfBuffer = await this.generateXmlPdf(
                savedNfcom,
                obsString,
              );

              // 3. Envia Email
              const emailService = new Email();
              const nomeArquivo = `NFCom_${savedNfcom.numeracao}.pdf`;

              // O método sendEmail espera optional attachments: any[]
              await emailService.sendEmail(
                emailDestino,
                `Nota Fiscal de Comunicação (NFCom) - Nº ${savedNfcom.numeracao}`,
                `Olá,\n\nSegue em anexo a Nota Fiscal de Comunicação (NFCom) modelo 62, referente à sua fatura.\nNúmero: ${savedNfcom.numeracao}\nSérie: ${savedNfcom.serie}\n\nAtenciosamente,\nWIP Telecom`,
                [
                  {
                    filename: nomeArquivo,
                    content: pdfBuffer,
                  },
                  {
                    filename: `NFCom_${savedNfcom.numeracao}.xml`,
                    content: Buffer.from(savedNfcom.xml, "utf-8"),
                  },
                ],
              );
              console.log(
                `📧 Email com PDF enviado para: ${emailDestino} (Nota ${savedNfcom.numeracao})`,
              );
            } else {
              console.warn(
                `Clientes sem email cadastrado na nota ${savedNfcom.numeracao}. Email não enviado.`,
              );
            }
          } catch (emailErr) {
            console.error(
              `Erro ao gerar/enviar email da nota ${savedNfcom.numeracao}:`,
              emailErr,
            );
          }
          // ------------------------------

          responses.push({
            success: true,
            id: item.nfComData.ide.nNF,
            message: "NFCom autorizada com sucesso",
          });
        } else {
          // Erro na autorização da NFCom
          console.error(
            `Erro ao autorizar nota ${item.nfComData.ide.nNF}: ${cStat} - ${xMotivo}`,
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
    faturaId: number,
    clientType: string,
    cpf_cnpj: string,
  ): Promise<NFCom> {
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
      novaNFCom.tipo = clientType;
      novaNFCom.cpf_cnpj = cpf_cnpj;

      novaNFCom.fatura_id = faturaId;
      novaNFCom.qrcodeLink = this.qrCodeUrl;
      novaNFCom.pppoe = clientLogin;
      novaNFCom.value = parseFloat(nfComData.total.vNF || "0") || 0;
      novaNFCom.tpAmb = this.homologacao ? 2 : 1;

      await NFComRepository.save(novaNFCom);
      console.log(`✅ NFCom ${novaNFCom.nNF} salva no banco com sucesso.`);
      return novaNFCom;
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
      "0",
    )}62${nfComData.ide.serie.padStart(3, "0")}${nfComData.ide.nNF.padStart(
      9,
      "0",
    )}${nfComData.ide.tpEmis}${
      nfComData.ide.nSiteAutoriz || "0"
    }${nfComData.ide.cNF.padStart(7, "0")}`;

    return `${chaveSemDV}${nfComData.ide.cDV}`;
  }

  public async getStatusJob(req: Request, res: Response) {
    const { id } = req.body;
    const response = await DataSource.getRepository(Jobs).findOne({
      where: { id },
    });
    console.log(response);
    res.status(200).json(response);
    return;
  }

  public async buscarNFCom(req: Request, res: Response) {
    try {
      const { searchParams, excludedIds, pagination } = req.body;
      console.log(searchParams);
      console.log(excludedIds);
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
        tipo: searchParams.clientType || undefined,
        cpf_cnpj: searchParams.cpf_cnpj || undefined,
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
          dataFimLimite, // Type Date (correto!)
        );
      }

      if (excludedIds) {
        whereConditions.nNF = Not(In(excludedIds));
      }

      const pageNumber = Number(pagination.page);

      console.log(pageNumber);

      // Verifica se o número da página é válido e calcula o 'skip'
      if (pageNumber > 0) {
        // CORREÇÃO: (Página Atual - 1) * Itens por página
        pagination.skip = (pageNumber - 1) * pagination.take;
      } else {
        pagination.skip = 0; // Se for página 0 ou inválida, começa do zero
      }

      // 3. Executa a busca com as condições montadas
      const NFComRepository = DataSource.getRepository(NFCom);
      const nfcom = await NFComRepository.find({
        where: whereConditions,
        skip: pagination.skip,
        take: pagination.take,
      });

      // Se precisar de mais detalhes, considere adicionar .relations, .order, etc.

      res.status(200).json(nfcom);
    } catch (error) {
      console.error("Erro ao buscar NFCom:", error);
      res.status(500).json({ error: "Erro ao buscar NFCom" });
    }
  }

  public async buscarNFComAll(req: Request, res: Response) {
    try {
      const { searchParams, excludedIds, pagination } = req.body;
      console.log(searchParams);
      console.log(excludedIds);
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
        tipo: searchParams.clientType || undefined,
        cpf_cnpj: searchParams.cpf_cnpj || undefined,
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
          dataFimLimite, // Type Date (correto!)
        );
      }

      if (excludedIds) {
        whereConditions.nNF = Not(In(excludedIds));
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

  public async NFComPages(req: Request, res: Response) {
    try {
      const { searchParams } = req.body;
      type NFComWhere = FindOptionsWhere<NFCom>;

      const whereConditions: NFComWhere = {
        // Garante que 'titulo' (ID da fatura) seja tratado como número, se for o caso
        fatura_id: searchParams.titulo
          ? Number(searchParams.titulo)
          : undefined,
        pppoe: searchParams.pppoe || undefined, // Evita buscar por pppoe vazio se não fornecido
        tpAmb: searchParams.tpAmb || undefined,
        serie: searchParams.serie || undefined,
        status: searchParams.status || undefined,
        tipo: searchParams.clientType || undefined,
        cpf_cnpj: searchParams.cpf_cnpj || undefined,
      };
      // 3. Executa a busca com as condições montadas
      const NFComRepository = DataSource.getRepository(NFCom);
      const nfcom = await NFComRepository.find({
        where: whereConditions,
      });

      // Se precisar de mais detalhes, considere adicionar .relations, .order, etc.
      const pages = Math.ceil(nfcom.length / 50);

      res.status(200).json(pages);
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
    tpAmb: number,
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

  private async cancelarNoBackground(
    nfcom: NFCom,
    pppoe: string,
    id: string,
    password: string,
    NFComRepository: Repository<NFCom>,
    jobRepository: Repository<Jobs>,
    job: Jobs,
  ) {
    job.processados += 1;
    await jobRepository.save(job);

    const nfcomData = await NFComRepository.findOne({
      where: {
        id: Number(id),
      },
    });

    if (!nfcomData) {
      job.status = "concluido";
      job.resultado = {
        cStat: "0",
        xMotivo: "NFCom não encontrada",
      };
      await jobRepository.save(job);
      return;
    }

    const nNF = nfcomData?.numeracao;

    console.log(id);

    console.log(nNF);

    const xmlCancelamento = this.criarXMLCancelamento(
      nfcom.chave,
      nfcom.protocolo,
      process.env.CPF_CNPJ as string,
      "Cancelamento por erro de cadastro",
      nfcom.tpAmb,
    );

    const assinado = this.assinarXmlCancelamento(
      xmlCancelamento,
      `evCancNFCom${nNF}`,
      password,
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
    const processedCertPath = processarCertificado(certPath, password, tempDir);

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

    if (cStat === "135" || cStat === "631") {
      console.log(
        `Nota ${nNF} cancelada! ${
          cStat === "631" ? "(Duplicidade de evento)" : ""
        }`,
      );

      nfcomData.status = "cancelada";
      await NFComRepository.save(nfcomData);
      job.status = "processando";
      job.resultado = {
        cStat,
        xMotivo,
      };
      await jobRepository.save(job);
      return;
    } else {
      console.log(`Erro ao cancelar nota ${nNF}: ${cStat} - ${xMotivo}`);
      job.status = "concluido";
      job.resultado = {
        cStat,
        xMotivo,
      };
      await jobRepository.save(job);

      return;
    }
  }

  public cancelarNFcom = async (req: Request, res: Response) => {
    try {
      let { id, password } = req.body;

      const NFComRepository = DataSource.getRepository(NFCom);
      const jobRepository = DataSource.getRepository(Jobs);

      const numerosParaBuscar = Array.isArray(id) ? id : [id];

      const listaNfcom = await NFComRepository.find({
        where: {
          id: In(numerosParaBuscar),
        },
      });

      if (!listaNfcom || listaNfcom.length === 0) {
        res.status(404).json({ error: "NFCom não encontrada" });
        return;
      }

      const job = jobRepository.create({
        name: "cancelarNFCom",
        description: "Cancelamento de NFCom",
        status: "pendente",
        total: listaNfcom.length,
        processados: 0,
        resultado: [], // Inicializa array vazio
      });

      await jobRepository.save(job);

      // ==========================================================
      // 1. RESPOSTA IMEDIATA (O usuário é liberado aqui)
      // ==========================================================
      res
        .status(200)
        .json({ message: "NFCom em processo de cancelamento!", id: job.id });

      // ==========================================================
      // 2. BACKGROUND (O Node continua rodando isso sozinho)
      // ==========================================================
      (async () => {
        console.log("Iniciando background...");

        for (const nf of listaNfcom) {
          try {
            const client = await AppDataSource.getRepository(
              ClientesEntities,
            ).findOne({
              where: { login: nf.pppoe },
            });

            if (!client) continue;

            // Define ambiente
            if (nf.tpAmb === 2) {
              this.homologacao = true;
              this.WSDL_URL =
                "https://nfcom-homologacao.svrs.rs.gov.br/WS/NFComRecepcao/NFComRecepcao.asmx";
            } else {
              this.homologacao = false;
              this.WSDL_URL =
                "https://nfcom.svrs.rs.gov.br/WS/NFComRecepcao/NFComRecepcao.asmx";
            }

            console.log("Processando NF:", nf.id);

            // Esse await NÃO segura o usuário (ele já recebeu a resposta lá em cima).
            // Ele serve apenas para o servidor processar Nota 1, depois Nota 2, etc.
            await this.cancelarNoBackground(
              nf,
              client.login,
              String(nf.id),
              password,
              NFComRepository,
              jobRepository,
              job,
            );
          } catch (error) {
            console.error("Erro no loop de background:", error);
          }
        }
        console.log("Fim do processamento em background.");
        job.status = "concluido";
        await jobRepository.save(job);
      })();

      // Removi o segundo res.json que estava aqui causando o erro
      return;
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erro ao cancelar NFCom" });
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
                    (Number(f.valor) - (cliente.desconto || 0)).toFixed(2),
                  )
                  .join(", ") || null,
            },
          };
        })
        .filter((i): i is NonNullable<typeof i> => i !== null)
        .sort((a, b) =>
          (b?.fatura?.titulo || "").localeCompare(a?.fatura?.titulo || ""),
        );
      res.status(200).json(arr);
    } catch {
      res.status(500).json({ message: "Erro ao buscar clientes" });
    }
  }

  private calcularDV(data: INFComData): string {
    const chaveSemDV = `${data.ide.cUF}${data.ide.dhEmi.substring(
      2,
      4,
    )}${data.ide.dhEmi.substring(5, 7)}${data.emit.CNPJ.padStart(
      14,
      "0",
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
      compressedBuffer.toString("hex").substring(0, 4),
    );

    return compressedBuffer.toString("base64");
  }

  public async enviarNfcom(xml: string, password: string = "0"): Promise<any> {
    try {
      const certPath = path.join(__dirname, "..", "files", "certificado.pfx");

      if (!fs.existsSync(certPath)) {
        throw new Error(`Certificado não encontrado em: ${certPath}`);
      }

      const tempDir = path.join(__dirname, "..", "temp");
      const processedCertPath = processarCertificado(
        certPath,
        password,
        tempDir,
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
    password: string,
  ): Promise<{ soapEnvelope: string; xmlAssinado: string }> {
    // 1. Gera Chave de Acesso
    const anoMes =
      data.ide.dhEmi.substring(2, 4) + data.ide.dhEmi.substring(5, 7);

    let chaveSemDV = `${data.ide.cUF}${anoMes}${data.emit.CNPJ.padStart(
      14,
      "0",
    )}62${data.ide.serie.padStart(3, "0")}${data.ide.nNF.padStart(9, "0")}${
      data.ide.tpEmis
    }${data.ide.nSiteAutoriz || "0"}${data.ide.cNF.padStart(7, "0")}`;

    const chaveAcessoCompleta = `${chaveSemDV}${data.ide.cDV}`;

    if (chaveAcessoCompleta.length !== 44) {
      throw new Error(
        `Chave de acesso gerada tem tamanho inválido: ${chaveAcessoCompleta.length} (esperado 44). Verifique cNF e nSiteAutoriz.`,
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
    gFat
      .ele("codBarras")
      .txt(
        data.gFat.codBarras ||
          "000000000000000000000000000000000000000000000000",
      );

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
        password,
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
      xmlComprimidoBase64.substring(0, 50),
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

    console.log(xmlInternoAssinado);

    console.log(soapEnvelope);

    return { soapEnvelope, xmlAssinado: xmlInternoAssinado };
  }

  private assinarXml(xml: string, idTag: string, password: string): string {
    const certPath = path.join(__dirname, "..", "files", "certificado.pfx");

    if (!fs.existsSync(certPath)) {
      throw new Error(`Certificado não encontrado em: ${certPath}`);
    }

    const pfxBuffer = fs.readFileSync(certPath);
    const pfxAsn1 = forge.asn1.fromDer(
      forge.util.createBuffer(pfxBuffer.toString("binary")),
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
        "Não foi possível extrair certificado ou chave privada do PFX.",
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
    password: string,
  ): string {
    const certPath = path.join(__dirname, "..", "files", "certificado.pfx");

    if (!fs.existsSync(certPath)) {
      throw new Error(`Certificado não encontrado em: ${certPath}`);
    }

    const pfxBuffer = fs.readFileSync(certPath);
    const pfxAsn1 = forge.asn1.fromDer(
      forge.util.createBuffer(pfxBuffer.toString("binary")),
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
        "Não foi possível extrair certificado ou chave privada do PFX.",
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

  private async generatePdf(
    nfcom: NFCom[],
    dataInicio: string,
    dataFim: string,
    password: string,
    p12FileBase64: string,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const dadosCert = this.extractCertData(p12FileBase64, password);

        const doc = new PDFDocument();
        const buffers: Buffer[] = [];

        doc.on("data", (chunk) => buffers.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(buffers)));

        doc
          .fontSize(20)
          .text(`COMPROVANTE DE TRANSMISSÃO DE ARQUIVO`, { align: "center" });
        doc.moveDown();
        doc.fontSize(12);
        doc.text(
          `Identificação Contribuinte: WIP TELECOM MULTIMIDIA EIRELI ME`,
        );
        doc.text(`CNPJ Contribuinte: 20.843.290/0001-42`);
        doc.text(`IE Contribuinte: 183013286115`);
        doc.text(
          `Data de Emissão: ${new Date().toLocaleDateString()}  Hora: ${new Date()
            .getHours()
            .toString()
            .padStart(2, "0")}:${new Date()
            .getMinutes()
            .toString()
            .padStart(2, "0")}:${new Date()
            .getSeconds()
            .toString()
            .padStart(2, "0")}`,
        );
        doc.moveDown();
        doc.text(`Documentos Fiscais Apresentados`);
        doc.text(`Periodo de  Emissão: ${dataInicio} a ${dataFim}`);
        console.log(nfcom[0].numeracao);
        console.log(nfcom[nfcom.length - 1].numeracao);

        doc.text(
          `Faixa de Numeração de ${nfcom[0].numeracao} até ${
            nfcom[nfcom.length - 1].numeracao
          }`,
        );
        doc.text(`Série: ${nfcom[0].serie}`);
        doc.text(`Total de Documentos: ${nfcom.length}`);
        doc.moveDown();
        doc.text("Somatorio de Valores");
        const totalValor = nfcom.reduce((total, item) => {
          // O Number() remove os zeros a esquerda e prepara para calculo
          // console.log(total + Number(item.value));

          return total + Number(item.value);
        }, 0);

        const valorFormatado = totalValor.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });

        doc.text(`Total: ${valorFormatado}`);
        doc.moveDown();
        if (dadosCert) {
          // Monta a string do nome + CNPJ conforme seu exemplo
          const linhaIdentificacao = dadosCert.cnpj
            ? `${dadosCert.nomeEmpresa}: ${dadosCert.cnpj}`
            : dadosCert.nomeEmpresa;

          doc.text("Certificado Digital Utilizado na Assinatura Digital:");
          doc.text(linhaIdentificacao); // Ex: WIP TELECOM... : 20.843...
          doc.text(`Numero de Serie: ${dadosCert.numeroSerie}`);
          doc.text(`Validade: ${dadosCert.dataInicio} a ${dadosCert.dataFim}`);
          doc.text(`Emissor: ${dadosCert.emissor}`);
        }

        doc.end();
      } catch (error) {
        reject(error);
        console.log(error);
      }
    });
  }

  private extractCertData = (
    p12Base64: string,
    password: string,
  ): CertificadoDados | null => {
    try {
      // --- CORREÇÃO AQUI ---
      // 1. Limpeza da string Base64
      // Remove prefixos como "data:application/x-pkcs12;base64," se existirem
      let base64Clean = p12Base64;

      if (base64Clean.includes(",")) {
        base64Clean = base64Clean.split(",")[1];
      }

      // Remove espaços em branco e quebras de linha (\n, \r) que podem corromper o decode
      base64Clean = base64Clean.replace(/\s/g, "");
      // ---------------------

      // 2. Decodificar o Base64 limpo para binário
      const p12Der = forge.util.decode64(base64Clean);
      const p12Asn1 = forge.asn1.fromDer(p12Der);

      // 3. Abrir o PKCS#12 com a senha
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

      // ... (Restante do código permanece igual)

      const bags = p12.getBags({ bagType: forge.pki.oids.certBag });
      const certBag = bags[forge.pki.oids.certBag]?.[0];

      if (!certBag) {
        throw new Error("Certificado não encontrado no arquivo P12/PFX.");
      }

      const cert = certBag.cert;
      if (!cert) return null;

      const cnAttr = cert.subject.getField("CN");
      const commonName = cnAttr ? cnAttr.value : "";

      let nomeEmpresa = commonName;
      let cnpj = "";

      if (commonName.includes(":")) {
        const parts = commonName.split(":");
        nomeEmpresa = parts[0];
        cnpj = parts[1];
      }

      const numeroSerie = cert.serialNumber.toUpperCase();
      const dataInicio = cert.validity.notBefore;
      const dataFim = cert.validity.notAfter;
      const inicioFormatado = dataInicio.toLocaleDateString("pt-BR");
      const fimFormatado = dataFim.toLocaleDateString("pt-BR");
      const issuerAttr = cert.issuer.getField("CN");
      const emissor = issuerAttr ? issuerAttr.value : "Desconhecido";

      return {
        nomeEmpresa,
        cnpj: this.formatarCNPJ(cnpj),
        numeroSerie,
        dataInicio: inicioFormatado,
        dataFim: fimFormatado,
        emissor,
      };
    } catch (error) {
      // Dica: Logar o tamanho da string ajuda a debugar se ela veio vazia
      console.error(
        `Erro ao ler certificado (Tamanho base64: ${p12Base64?.length})`,
        error,
      );
      return null;
    }
  };

  // Função auxiliar simples para formatar CNPJ
  private formatarCNPJ = (v: string) => {
    v = v.replace(/\D/g, "");
    return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  };

  private converterLinhaDigitavelParaBarras = (linha: string): string => {
    // Remove qualquer caractere que não seja número
    const codigo = linha.replace(/[^0-9]/g, "");

    // Se já tiver 44 dígitos, retorna ele mesmo
    if (codigo.length === 44) return codigo;

    // Se tiver 47 dígitos (Padrão Boleto Bancário)
    if (codigo.length === 47) {
      // Pega as partes "úteis" ignorando os Dígitos Verificadores (posições 9, 20 e 31)
      // Estrutura da Linha Digitável:
      // Campo 1: pos 0-8 (9 dígitos) + DV (1)
      // Campo 2: pos 10-19 (10 dígitos) + DV (1)
      // Campo 3: pos 21-30 (10 dígitos) + DV (1)
      // Campo 4: pos 32 (DV Geral)
      // Campo 5: pos 33-46 (Fator + Valor)

      // Remontagem para o padrão de Barras (44 dígitos):
      // pos 0-2 (Banco)
      // pos 3 (Moeda)
      // pos 32 (DV Geral - vai para a posição 4 do código de barras)
      // pos 33-46 (Fator Vencimento + Valor)
      // pos 4-8 (Campo Livre 1)
      // pos 10-19 (Campo Livre 2)
      // pos 21-30 (Campo Livre 3)

      const p1 = codigo.substring(0, 4); // Banco + Moeda
      const p2 = codigo.substring(32, 33); // DV Geral (K)
      const p3 = codigo.substring(33, 47); // Fator + Valor
      const p4 = codigo.substring(4, 9); // Campo Livre Bloco 1
      const p5 = codigo.substring(10, 20); // Campo Livre Bloco 2
      const p6 = codigo.substring(21, 31); // Campo Livre Bloco 3

      return `${p1}${p2}${p3}${p4}${p5}${p6}`;
    }

    // Se for Arrecadação (Começa com 8 e tem 48 dígitos), a lógica é outra.
    // Mas seu código começa com 364 (Banco), então é o caso acima de 47 dígitos.

    return codigo; // Retorna original se não souber tratar
  };

  private generateXmlPdf = async (
    nfcom: NFCom,
    obs: string,
  ): Promise<Buffer> => {
    return new Promise<Buffer>(async (resolve, reject) => {
      try {
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: "",
          parseTagValue: false,
        });

        const xmlString = nfcom.xml;
        const parsed = parser.parse(xmlString);

        // Tenta encontrar o root diretamente ou dentro de nfcomProc
        let root = parsed.NFCom || parsed.nfCom || parsed["ns:NFCom"];

        if (!root && parsed.nfcomProc) {
          root = parsed.nfcomProc.NFCom || parsed.nfcomProc["ns:NFCom"];
        }

        if (!root) throw new Error("Elemento raiz NFCom não encontrado no XML");

        const inf = root.infNFCom || root["ns:infNFCom"];
        const prot =
          root.protNFCom?.infProt || parsed.nfcomProc?.protNFCom?.infProt;

        if (!inf) throw new Error("Elemento infNFCom não encontrado");

        // Handle Namespaces for Supl
        const supl = inf.infNFComSupl || inf["ns:infNFComSupl"];
        const qrCodeValue = supl
          ? supl.qrCodNFCom || supl["ns:qrCodNFCom"]
          : nfcom.qrcodeLink;

        const data = {
          ide: inf.ide,
          obs: obs,
          emit: inf.emit,
          dest: inf.dest,
          det: Array.isArray(inf.det) ? inf.det : [inf.det],
          total: inf.total,
          gFat: inf.gFat,
          prot: prot,
          qrCode: qrCodeValue,
          chave: nfcom.chave || inf.ide.cNF,
        };

        const doc = new PDFDocument({ margin: 20, size: "A4" });
        const buffers: Buffer[] = [];
        doc.on("data", (chunk) => buffers.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(buffers)));

        // --- VARIAVEIS DE LAYOUT ---
        const pageWidth = 595.28; // A4 width in points (72 dpi)
        const pageHeight = 841.89;
        const margin = 20;
        const contentWidth = pageWidth - margin * 2;
        let y = margin;

        const blueColor = "#48A9C5"; // Cor azul claro das caixas

        // --- HELPERS ---
        const formatCurrency = (val: any) => {
          const num = Number(val);
          if (isNaN(num)) return "0,00";
          return num.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        };
        const formatDate = (dateStr: string) => {
          if (!dateStr) return "";
          return new Date(dateStr).toLocaleDateString("pt-BR");
        };

        // --- CABEÇALHO ---
        // Fundo Cinza do Cabeçalho
        doc.rect(margin, y, contentWidth, 85).fill("#F0F0F0");
        doc.fillColor("black");

        doc
          .fontSize(10)
          .font("Helvetica-Bold")
          .text(
            "DOCUMENTO AUXILIAR DA NOTA FISCAL FATURA DE SERVIÇOS DE COMUNICAÇÃO ELETRÔNICA",
            margin + 10,
            y + 10,
          );

        // Dados do Emitente
        doc
          .fontSize(9)
          .font("Helvetica-Bold")
          .text(data.emit.xNome.toUpperCase(), margin + 10, y + 30);
        doc.font("Helvetica").fontSize(8);
        const ender = data.emit.enderEmit;
        doc.text(
          `${ender.xLgr}, ${ender.nro} - ${ender.xBairro} - ${ender.xMun}/${ender.UF}`,
          margin + 10,
          y + 42,
        );
        doc.text(`CEP: ${ender.CEP}`, margin + 10, y + 52);
        doc.text(
          `CNPJ: ${data.emit.CNPJ} - IE: ${data.emit.IE}`,
          margin + 10,
          y + 62,
        );

        y += 95;

        // --- DADOS DO DESTINATÁRIO E DA NOTA (2 COLUNAS) ---
        const col1Wid = contentWidth * 0.45;
        const col2X = margin + col1Wid + 10;
        const startInfoY = y;

        // Coluna 1: Destinatário
        doc
          .font("Helvetica-Bold")
          .fontSize(9)
          .text(data.dest.xNome.toUpperCase(), margin, y);
        doc.font("Helvetica").fontSize(8);
        const destEnd = data.dest.enderDest;
        doc.text(
          `${destEnd.xLgr || ""}, ${destEnd.nro || ""} - ${
            destEnd.xBairro || ""
          }`,
          margin,
          y + 12,
        );
        doc.text(
          `CEP: ${destEnd.CEP || ""} - ${destEnd.xMun || ""} - ${
            destEnd.UF || ""
          }`,
          margin,
          y + 22,
        );
        doc.text(
          `CPF/CNPJ: ${data.dest.CNPJ || data.dest.CPF}`,
          margin,
          y + 32,
        );
        doc.text(`IE: ${data.dest.IE || "ISENTO"}`, margin, y + 42);
        doc.text(`CÓDIGO DO CLIENTE: ${data.dest.id || ""}`, margin, y + 52);
        const fone = data.dest.enderDest.fone || data.emit.enderEmit.fone;
        doc.text(`TELEFONE: ${fone || ""}`, margin, y + 62);

        // Coluna 2: Dados da Nota + QR Code
        const qrBoxSize = 65;
        if (data.qrCode) {
          try {
            const qrBase64 = await QRCode.toDataURL(data.qrCode);
            if (qrBase64) {
              doc.image(qrBase64, col2X, y, {
                width: qrBoxSize,
                height: qrBoxSize,
              });
            }
          } catch (e) {
            console.error("Erro ao gerar QRCode:", e);
            doc.rect(col2X, y, qrBoxSize, qrBoxSize).stroke();
            doc.fontSize(8).text("QR Inválido", col2X + 5, y + 25);
          }
        }

        const infoX = col2X + qrBoxSize + 10;
        doc.fillColor("black");
        doc
          .font("Helvetica-Bold")
          .fontSize(9)
          .text(`NOTA FISCAL Nº: ${data.ide.nNF}`, infoX, y);
        doc.text(`SÉRIE: ${data.ide.serie}`, infoX, y + 12);
        doc.text(
          `DATA DE EMISSÃO: ${formatDate(data.ide.dhEmi)}`,
          infoX,
          y + 24,
        );

        doc.fontSize(7).font("Helvetica");
        doc.text("CONSULTE PELA CHAVE DE ACESSO EM:", infoX, y + 36);
        doc
          .fillColor("blue")
          .text("https://dfe-portal.svrs.rs.gov.br/nfcom", infoX, y + 44, {
            link: "https://dfe-portal.svrs.rs.gov.br/nfcom",
            underline: true,
          });
        doc.fillColor("black");

        doc.font("Helvetica-Bold").text("CHAVE DE ACESSO:", infoX, y + 56);
        const chaveFmt = (data.chave || "").replace(/(\d{4})/g, "$1 ").trim();
        doc.font("Helvetica").text(chaveFmt, infoX, y + 64);

        if (data.prot) {
          doc.text(
            `Protocolo de Autorização: ${data.prot.nProt} - ${formatDate(
              data.prot.dhRecbto,
            )}`,
            infoX,
            y + 76,
          );
        }

        y += 90;

        // --- CAIXAS DE DESTAQUE (Ref, Venc, Valor) ---
        // Layout: 3 caixas verticais na esquerda + 1 caixa grande na direita (Area Contribuinte)
        const leftBoxW = 180;
        const rightBoxX = margin + leftBoxW + 10;
        const rightBoxW = contentWidth - leftBoxW - 10;
        const boxH = 20;
        const gap = 5;

        // Parse Reference Month
        let ref = "";
        if (data.gFat && data.gFat.CompetFat) {
          const compStr = String(data.gFat.CompetFat);
          const yyyy = compStr.substring(0, 4);
          const mm = compStr.substring(4, 6);
          ref = `${mm}/${yyyy}`;
        }

        const drawLeftBox = (lbl: string, val: string, curY: number) => {
          doc.roundedRect(margin, curY, leftBoxW, boxH, 3).fill(blueColor);
          doc.fillColor("white").fontSize(8).font("Helvetica-Bold");
          doc.text(lbl, margin + 5, curY + 6);
          doc.text(val, margin + 100, curY + 6, {
            align: "right",
            width: leftBoxW - 110,
          });
        };

        drawLeftBox("REFERÊNCIA (ANO/MÊS):", ref, y);
        drawLeftBox(
          "VENCIMENTO:",
          data.gFat && data.gFat.dVencFat ? formatDate(data.gFat.dVencFat) : "",
          y + boxH + gap,
        );
        drawLeftBox(
          "TOTAL A PAGAR:",
          `R$ ${formatCurrency(data.total.vNF)}`,
          y + (boxH + gap) * 2,
        );

        // Caixa Direita (Area Contribuinte)
        const rightBoxH = boxH * 3 + gap * 2;
        doc.roundedRect(rightBoxX, y, rightBoxW, rightBoxH, 5).fill("#E0E0E0");
        doc
          .fillColor("black")
          .fontSize(9)
          .font("Helvetica-Bold")
          .text("ÁREA DO CONTRIBUINTE:", rightBoxX, y + 10, {
            align: "center",
            width: rightBoxW,
          });
        doc.font("Helvetica").text("", rightBoxX, y + 25, {
          align: "center",
          width: rightBoxW,
        });

        y += rightBoxH + 15;

        // --- TABELA DE ITENS ---
        // Total Available Width: 555 (approx)
        const cols = [
          { name: "ITENS DA FATURA", x: margin, w: 175, align: "left" },
          { name: "UN", x: margin + 175, w: 25, align: "center" },
          { name: "QUANT", x: margin + 200, w: 45, align: "right" },
          { name: "PREÇO UNIT", x: margin + 245, w: 55, align: "right" },
          { name: "VALOR TOTAL", x: margin + 300, w: 55, align: "right" },
          { name: "PIS/COFINS", x: margin + 355, w: 50, align: "right" },
          { name: "BC ICMS", x: margin + 405, w: 50, align: "right" },
          { name: "ALIQ", x: margin + 455, w: 30, align: "right" },
          { name: "VALOR ICMS", x: margin + 485, w: 50, align: "right" },
        ];

        // Header Table
        doc.rect(margin, y, contentWidth, 15).fill("#E0E0E0");
        doc.fillColor("black").font("Helvetica-Bold").fontSize(7);
        cols.forEach((col) => {
          doc.text(col.name, col.x + 2, y + 5, {
            width: col.w - 4,
            align: col.align as any,
          });
        });

        y += 15;
        doc.font("Helvetica").fontSize(7);

        // Itens
        data.det.forEach((item: any, i: number) => {
          if (y > pageHeight - 120) {
            doc.addPage();
            y = margin;
          }

          const vItem = Number(item.prod.vItem || 0);
          const qCom = Number(item.prod.qFaturada || 0);
          const vUnCom = Number(item.prod.vUnCom || (qCom ? vItem / qCom : 0));

          // Extração segura de impostos
          const icms = item.imposto?.ICMS00 || {};
          const pis = item.imposto?.PIS || {}; // Ajustar conforme estrutura real XML
          const cofins = item.imposto?.COFINS || {};

          doc.text(item.prod.xProd.substring(0, 60), cols[0].x + 2, y + 2, {
            width: cols[0].w,
          });
          doc.text("UN", cols[1].x + 2, y + 2, {
            width: cols[1].w,
            align: "center",
          });
          doc.text(formatCurrency(qCom), cols[2].x, y + 2, {
            width: cols[2].w,
            align: "right",
          });
          doc.text(formatCurrency(vUnCom), cols[3].x, y + 2, {
            width: cols[3].w,
            align: "right",
          });
          doc.text(formatCurrency(item.prod.vProd), cols[4].x, y + 2, {
            width: cols[4].w,
            align: "right",
          });

          doc.text("0,00", cols[5].x, y + 2, {
            width: cols[5].w,
            align: "right",
          }); // Placeholder PIS/COFINS
          doc.text(formatCurrency(icms.vBC || 0), cols[6].x, y + 2, {
            width: cols[6].w,
            align: "right",
          });
          doc.text(formatCurrency(icms.pICMS || 0), cols[7].x, y + 2, {
            width: cols[7].w,
            align: "right",
          });
          doc.text(formatCurrency(icms.vICMS || 0), cols[8].x, y + 2, {
            width: cols[8].w,
            align: "right",
          });

          doc
            .moveTo(margin, y + 12)
            .lineTo(pageWidth - margin, y + 12)
            .dash(1, { space: 2 })
            .strokeColor("#CCC")
            .stroke()
            .undash();
          doc.strokeColor("black");
          y += 14;
        });

        y += 5;

        // --- TOTAIS ---
        doc.rect(margin, y, contentWidth, 20).fill("#F0F0F0");
        doc.fillColor("black").font("Helvetica-Bold").fontSize(7);

        // Vamos distribuir os totais horizontalmente
        const totalLabels = [
          "VALOR TOTAL NFF",
          "TOTAL BASE DE CÁLCULO",
          "VALOR ICMS",
          "VALOR ISENTO",
          "VALOR OUTROS",
        ];
        const totalValues = [
          formatCurrency(data.total.vNF),
          formatCurrency(data.total.ICMSTot.vBC),
          formatCurrency(data.total.ICMSTot.vICMS),
          "0,00",
          formatCurrency(data.total.vOutro),
        ];

        const totW = contentWidth / 5;
        totalLabels.forEach((lbl, i) => {
          const tx = margin + totW * i;
          doc.text(lbl, tx, y + 4, { width: totW, align: "center" });
          doc.text(totalValues[i], tx, y + 12, {
            width: totW,
            align: "center",
          });
          if (i < 4)
            doc
              .moveTo(tx + totW, y)
              .lineTo(tx + totW, y + 20)
              .strokeColor("#CCC")
              .stroke(); // Separadores
        });
        doc.strokeColor("black");

        y += 25;

        // --- INFORMAÇÕES TRIBUTOS E FISCO ---
        const halfW = (contentWidth - 10) / 2;

        // Esquerda: Tributos (Tabela simples)
        doc.rect(margin, y, halfW, 45).fill("#F0F0F0"); // Header
        doc
          .rect(margin, y + 15, halfW, 30)
          .fill("white")
          .stroke(); // Body
        doc
          .fillColor("black")
          .font("Helvetica-Bold")
          .text("INFORMAÇÕES DOS TRIBUTOS", margin, y + 5, {
            width: halfW,
            align: "center",
          });

        // Itens tributos
        const tribY = y + 20;
        doc.font("Helvetica").fontSize(7);
        doc.text("PIS", margin + 5, tribY);
        doc.text(formatCurrency(data.total.vPIS), margin + 5, tribY, {
          width: halfW - 10,
          align: "right",
        });
        doc.text("COFINS", margin + 5, tribY + 10);
        doc.text(formatCurrency(data.total.vCOFINS), margin + 5, tribY + 10, {
          width: halfW - 10,
          align: "right",
        });
        doc.text("FUST/FUNTTEL", margin + 5, tribY + 20);
        doc.text(
          formatCurrency(
            Number(data.total.vFUST || 0) + Number(data.total.vFUNTTEL || 0),
          ),
          margin + 5,
          tribY + 20,
          { width: halfW - 10, align: "right" },
        );

        // Direita: Reservado ao Fisco
        doc.rect(margin + halfW + 10, y, halfW, 45).fill("#F0F0F0");
        doc
          .rect(margin + halfW + 10, y + 15, halfW, 30)
          .fill("white")
          .stroke();
        doc
          .fillColor("black")
          .font("Helvetica-Bold")
          .text("RESERVADO AO FISCO", margin + halfW + 10, y + 5, {
            width: halfW,
            align: "center",
          });

        y += 55;

        // --- INFO COMPLEMENTAR ---
        doc.rect(margin, y, contentWidth, 30).fill("#F0F0F0");
        doc
          .fillColor("black")
          .font("Helvetica-Bold")
          .text("INFORMAÇÕES COMPLEMENTARES", margin, y + 5, {
            width: contentWidth,
            align: "center",
          });
        doc
          .rect(margin, y + 15, contentWidth, 15)
          .fill("white")
          .stroke();
        doc
          .font("Helvetica")
          .fontSize(7)
          .text(
            "NFCOM EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO - SEM VALOR FISCAL",
            margin + 5,
            y + 20,
          );

        y += 20;

        doc.rect(margin, y, contentWidth, 30).fill("#F0F0F0");
        doc
          .fillColor("black")
          .font("Helvetica-Bold")
          .text("OBSERVAÇÃO", margin, y + 5, {
            width: contentWidth,
            align: "center",
          });

        doc
          .rect(margin, y + 15, contentWidth, 40)
          .fill("white")
          .stroke();

        doc
          .font("Helvetica")
          .fontSize(7)
          .fillColor("black")
          .text(
            `I Documento emitido por ME ou EPP optante do Simples Nacional \nII Não gera direito a crédito fiscal de IPI \nValor Aproximado dos tributos federais 13,45% e municipais 2,00% Fonte: IBPT Chave ${data.obs}`,
            margin + 5,
            y + 20,
            {
              width: contentWidth - 10,
              align: "left",
            },
          );

        y += 60;

        // --- BARCODE (Correção 47 -> 44 Dígitos) ---
        if (data.gFat && data.gFat.codBarras) {
          try {
            const linhaDigitavel = String(data.gFat.codBarras).replace(
              /\D/g,
              "",
            );

            // 1. Converte para o formato de barras (44 dígitos) para gerar a IMAGEM
            const codigoParaBarras =
              this.converterLinhaDigitavelParaBarras(linhaDigitavel);

            // console.log(
            //   `Barcode Debug | Linha: ${linhaDigitavel.length} chars | Barras: ${codigoParaBarras.length} chars`
            // );

            // 2. Gera a imagem usando os 44 dígitos (agora par e correto)
            const barcodeBuffer = await bwipjs.toBuffer({
              bcid: "interleaved2of5",
              text: codigoParaBarras, // Usa o código convertido!
              scale: 3,
              height: 12,
              includetext: false,
              textxalign: "center",
            });

            // Fundo cinza
            doc.rect(margin, y, contentWidth, 55).fill("#F0F0F0");

            // Desenha a imagem
            const imgWidth = 300;
            const imgHeight = 35;
            const xPos = margin + (contentWidth - imgWidth) / 2;
            doc.image(barcodeBuffer, xPos, y + 5, {
              width: imgWidth,
              height: imgHeight,
            });

            // 3. Escreve a LINHA DIGITÁVEL original formatada (para leitura humana)
            // Formata: 36490.00050 00006.009104 ... (Padrão visual de boleto)
            let textoLegivel = linhaDigitavel;
            if (linhaDigitavel.length === 47) {
              textoLegivel = `${linhaDigitavel.substring(
                0,
                5,
              )}.${linhaDigitavel.substring(5, 10)}  ${linhaDigitavel.substring(
                10,
                15,
              )}.${linhaDigitavel.substring(
                15,
                21,
              )}  ${linhaDigitavel.substring(
                21,
                26,
              )}.${linhaDigitavel.substring(
                26,
                32,
              )}  ${linhaDigitavel.substring(
                32,
                33,
              )}  ${linhaDigitavel.substring(33)}`;
            }

            doc
              .fillColor("black")
              .font("Helvetica-Bold")
              .fontSize(10)
              .text(textoLegivel, margin, y + 45, {
                width: contentWidth,
                align: "center",
              });
          } catch (e: any) {
            console.error("Erro Barcode:", e);
            doc.rect(margin, y, contentWidth, 50).stroke();
            doc
              .fillColor("red")
              .text("Erro no código de barras", margin + 10, y + 20);
          }
        }

        doc.end();
      } catch (error) {
        console.error("Erro ao gerar PDF XML:", error);
        reject(error);
      }
    }); // End Promise
  }; // End Method

  public generatePdfFromNfXML = async (req: Request, res: Response) => {
    try {
      const { id, obs } = req.body;

      const NFComRepository = DataSource.getRepository(NFCom);
      const nfcom = await NFComRepository.findOne({
        where: {
          id: id,
        },
      });
      if (!nfcom) {
        res.status(404).json({ error: "NFCom não encontrada" });
        return;
      }
      const pdf = await this.generateXmlPdf(nfcom, obs);
      res.set("Content-Type", "application/pdf");
      res.set(
        "Content-Disposition",
        "attachment; filename=" + nfcom.nNF + ".pdf",
      );
      res.send(pdf);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erro ao gerar PDF" });
    }
  };

  public generateReportPdf = async (req: Request, res: Response) => {
    try {
      const { id, dataInicio, dataFim, password } = req.body;
      console.log(id, dataInicio, dataFim);

      const NFComRepository = DataSource.getRepository(NFCom);
      const nfcom = await NFComRepository.find({
        where: {
          id: In(id),
        },
      });
      if (!nfcom) {
        res.status(404).json({ error: "NFCom não encontrada" });
        return;
      }

      const caminhoArquivo = path.resolve(
        __dirname,
        "../files/certificado.pfx",
      );

      const fileBuffer = fs.readFileSync(caminhoArquivo);

      const pfxFileBase64 = fileBuffer.toString("base64");

      const pdf = await this.generatePdf(
        nfcom,
        dataInicio,
        dataFim,
        password,
        pfxFileBase64,
      );
      res.set("Content-Type", "application/pdf");
      res.set(
        "Content-Disposition",
        "attachment; filename=" + nfcom[0].nNF + ".pdf",
      );
      res.send(pdf);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erro ao gerar PDF" });
    }
  };
}

export default Nfcom;
