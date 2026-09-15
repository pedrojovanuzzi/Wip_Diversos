import * as fs from "fs";
import * as path from "path";
import * as tls from "tls";
import * as dotenv from "dotenv";
import { Request, Response } from "express";
import { DOMParser } from "xmldom";
import axios from "axios";
import moment from "moment-timezone";
import { In, Between, IsNull, Not, Like, Raw } from "typeorm";
import { parseStringPromise } from "xml2js";

import AppDataSource from "../database/DataSource";
import MkauthSource from "../database/MkauthSource";
import { NFSE } from "../entities/NFSE";
import { ClientesEntities } from "../entities/ClientesEntities";
import { Faturas } from "../entities/Faturas";
import { Jobs } from "../entities/Jobs";

import { formatBRL, nomeStreaming } from "../config/servicosAdicionais";
import {
  buscarResumoCameras,
  buscarResumoCameraDeUmLogin,
  nomeServicoCamera,
  sqlTagServico,
} from "../services/servicosAdicionaisNomes";

import { NfseXmlFactory } from "../services/nfse/NfseXmlFactory";
import {
  ACAO_NACIONAL,
  MensagemNacional,
  NfseNacionalXmlFactory,
  NotaNacional,
  URL_WS_NACIONAL,
  lerMensagens,
  lerNotas,
  lerStatus,
  notaNacionalNoFormatoAbrasf,
} from "../services/nfse/NfseNacionalXmlFactory";
import { validarCertificadoPfx } from "../utils/certUtils";
import { FiorilliProvider } from "../services/nfse/FiorilliProvider";

dotenv.config();

/** Município do prestador (Arealva-SP): emissão e local da prestação. */
const CODIGO_MUNICIPIO = "3503406";

/** Código IBGE da cidade do tomador; sem resposta válida, fica o do prestador. */
async function codigoIbgeDaCidade(cidade?: string | null): Promise<string> {
  if (!cidade) return CODIGO_MUNICIPIO;
  try {
    const resp = await axios.get(
      `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${encodeURIComponent(cidade)}`,
      { timeout: 10000 },
    );
    const id = String(resp.data?.id ?? "");
    return /^\d{7}$/.test(id) ? id : CODIGO_MUNICIPIO;
  } catch {
    return CODIGO_MUNICIPIO;
  }
}

/** Texto curto das mensagens da prefeitura, para o resultado do job/tela. */
function resumoMensagens(mensagens: MensagemNacional[]): string {
  return mensagens
    .map((m) => [m.codigo, m.mensagem, m.correcao].filter(Boolean).join(" - "))
    .join(" | ");
}

/**
 * Próximo RPS a partir do último informado pelo usuário.
 *
 * A NFSE passou a exigir o número do RPS digitado: não dá mais para descobrir
 * sozinho qual é o próximo. O usuário informa o último usado e a nota sai com
 * o seguinte; num lote, cada nota seguinte soma mais um.
 *
 * Devolve `null` quando o valor não é um número inteiro (vazio, letras, etc.).
 */
function proximoNumeroRps(ultimo: unknown): number | null {
  const texto = String(ultimo ?? "").trim();
  if (!/^\d+$/.test(texto)) return null;
  return Number(texto) + 1;
}

class NFSEController {
  private certPath = path.resolve(__dirname, "../files/certificado.pfx");
  private TEMP_DIR = path.resolve(__dirname, "../files");
  private homologacao: boolean = false;
  private WSDL_URL = "";
  private PASSWORD = "";

  /** XML ABRASF: só para consultar/cancelar as notas antigas. */
  private xmlFactory: NfseXmlFactory;
  /** XML da NFS-e Nacional: emissão, cancelamento e consulta das notas novas. */
  private nacionalXml: NfseNacionalXmlFactory;
  /** Web service nacional (IssWebWSNacional). */
  private fiorilliProvider: FiorilliProvider;
  /** Web service antigo (IssWebWS / ABRASF), mantido para as notas antigas. */
  private legacyProvider: FiorilliProvider;
  private ultimoNumeroLote = 0;

  constructor() {
    this.xmlFactory = new NfseXmlFactory();
    this.nacionalXml = new NfseNacionalXmlFactory();
    this.legacyProvider = new FiorilliProvider(
      this.certPath,
      this.TEMP_DIR,
      "",
    );
    // Provider will be initialized properly when we have the WSDL URL set in 'iniciar' or defaults
    // For now we set partial defaults, but WSDL might change based on 'homologacao'
    this.fiorilliProvider = new FiorilliProvider(
      this.certPath,
      this.TEMP_DIR,
      "",
    );

    this.uploadCertificado = this.uploadCertificado.bind(this);
    this.iniciar = this.iniciar.bind(this);
    this.processarGeracaoNfseJob = this.processarGeracaoNfseJob.bind(this);
    // this.gerarRpsXml = this.gerarRpsXml.bind(this); // Refactored into internal helper or factory usage
    this.imprimirNFSE = this.imprimirNFSE.bind(this);
    this.verificaRps = this.verificaRps.bind(this);
    this.cancelarNfse = this.cancelarNfse.bind(this);
    this.processarCancelamentoNfseJob =
      this.processarCancelamentoNfseJob.bind(this);
    this.setPassword = this.setPassword.bind(this);
    this.setNfseNumber = this.setNfseNumber.bind(this);
    this.setNfseStatus = this.setNfseStatus.bind(this);
    this.BuscarNSFE = this.BuscarNSFE.bind(this);
    this.BuscarNSFEDetalhes = this.BuscarNSFEDetalhes.bind(this);
    this.BuscarClientes = this.BuscarClientes.bind(this);
    this.removerAcentos = this.removerAcentos.bind(this);
    this.GerarNfseAvulsa = this.GerarNfseAvulsa.bind(this);
  }

  private configureProvider(ambiente: string = "producao") {
    const homologacao = ambiente === "homologacao";

    // Emissão passou para a NFS-e Nacional.
    this.WSDL_URL = homologacao
      ? URL_WS_NACIONAL.homologacao
      : URL_WS_NACIONAL.producao;
    this.fiorilliProvider = new FiorilliProvider(
      this.certPath,
      this.TEMP_DIR,
      this.WSDL_URL,
    );

    // O ABRASF continua para as notas emitidas antes da troca.
    this.legacyProvider = new FiorilliProvider(
      this.certPath,
      this.TEMP_DIR,
      homologacao
        ? "http://fi1.fiorilli.com.br:5663/IssWeb-ejb/IssWebWS/IssWebWS?wsdl"
        : "https://wsnfe.arealva.sp.gov.br:8443/IssWeb-ejb/IssWebWS/IssWebWS?wsdl",
    );
  }

  private prestadorDoAmbiente(ambiente: string) {
    const homologacao = ambiente === "homologacao";
    return {
      cnpj:
        (homologacao
          ? process.env.MUNICIPIO_CNPJ_TEST
          : process.env.MUNICIPIO_LOGIN) || "",
      inscricao:
        (homologacao
          ? process.env.MUNICIPIO_INCRICAO_TEST
          : process.env.MUNICIPIO_INCRICAO) || "",
    };
  }

  /**
   * Assina as DPS, envia o lote síncrono e separa o resultado de cada uma.
   *
   * No lote nacional a prefeitura pode autorizar parte das DPS e recusar
   * outras (as mensagens trazem o IdDPS); cada DPS recebe a sua nota ou os
   * seus erros. Mensagem sem IdDPS vale para o lote inteiro.
   */
  private async enviarDpsNacional(
    dps: { id: string; xml: string }[],
    password: string,
    ambiente: string,
  ): Promise<{
    responseXml: string;
    porDps: Map<string, { nota?: NotaNacional; erros: MensagemNacional[] }>;
  }> {
    const { cnpj, inscricao } = this.prestadorDoAmbiente(ambiente);

    // Número de lote único a cada envio (a prefeitura recusa lote repetido,
    // E233): segundos atuais, sempre acima do último usado. Em milissegundos
    // estoura o inteiro de 32 bits do servidor e volta negativo.
    const numeroLote = Math.max(
      Math.floor(Date.now() / 1000),
      this.ultimoNumeroLote + 1,
    );
    this.ultimoNumeroLote = numeroLote;

    const assinadas = dps.map((d) =>
      this.fiorilliProvider.assinarXml(d.xml, "infDPS", password),
    );
    const soapXml = this.nacionalXml.createLoteSincronoSoap(
      numeroLote,
      cnpj,
      inscricao,
      assinadas,
    );

    if (!fs.existsSync("log")) fs.mkdirSync("log", { recursive: true });
    fs.appendFileSync("./log/xml_log.txt", soapXml + "\n", "utf8");

    let responseXml: string;
    try {
      responseXml = await this.fiorilliProvider.sendSoapRequest(
        soapXml,
        ACAO_NACIONAL.lote,
        password,
      );
    } catch (err: any) {
      // SOAP Fault chega como HTTP 500: o corpo traz o motivo.
      if (!err?.response?.data) throw err;
      responseXml = String(err.response.data);
    }

    console.log("XML Response (NFS-e Nacional): ", responseXml);

    const notas = lerNotas(responseXml);
    const mensagens = lerMensagens(responseXml);
    const gerais = mensagens.filter((m) => !m.idDps);

    const porDps = new Map<
      string,
      { nota?: NotaNacional; erros: MensagemNacional[] }
    >();
    dps.forEach((d, i) => {
      const nota =
        notas.find((n) => n.idDps === d.id) ||
        // Resposta sem o Id da DPS dentro da nota: casa pela ordem.
        (notas.length === dps.length && !notas[i]?.idDps
          ? notas[i]
          : undefined);
      const erros = mensagens.filter((m) => m.idDps === d.id);
      porDps.set(d.id, {
        nota,
        erros: nota ? [] : erros.length ? erros : gerais,
      });
    });

    return { responseXml, porDps };
  }

  /**
   * Recebe o certificado A1 e só o coloca em uso depois de abrir o PKCS#12 com a
   * senha informada.
   *
   * Antes esta rota respondia "enviado com sucesso" sem olhar nada: um arquivo
   * recusado pelo filtro, ou a senha errada, só apareciam muito depois, na
   * emissão, como um "mac verify failure" sem contexto — e o certificado que
   * estava funcionando já tinha sido sobrescrito.
   */
  public async uploadCertificado(req: Request, res: Response) {
    const arquivo = (req.files as Express.Multer.File[] | undefined)?.[0];
    const tempDir = path.join(__dirname, "..", "temp");
    // Arquivo temporário gravado por nós: writeFileSync fecha o descritor antes
    // de retornar, então a validação (que abre o arquivo pelo caminho) não
    // esbarra em lock no Windows.
    let temporario: string | null = null;

    const limpar = () => {
      if (!temporario) return;
      try {
        fs.unlinkSync(temporario);
      } catch {
        /* já removido */
      }
      temporario = null;
    };

    try {
      if (!arquivo?.buffer?.length) {
        res.status(400).json({
          erro: "Nenhum arquivo recebido. Selecione o certificado .pfx (ou .p12).",
        });
        return;
      }

      const senha = String(req.body?.password ?? "");
      if (!senha) {
        res.status(400).json({ erro: "Informe a senha do certificado." });
        return;
      }

      fs.mkdirSync(tempDir, { recursive: true });
      temporario = path.join(tempDir, `upload_certificado_${Date.now()}.pfx`);
      fs.writeFileSync(temporario, arquivo.buffer);

      const falha = validarCertificadoPfx(temporario, senha, tempDir);
      if (falha) {
        limpar();
        res.status(400).json({ erro: `${falha} O certificado anterior foi mantido.` });
        return;
      }

      const destino = path.join(__dirname, "..", "files", "certificado.pfx");
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      fs.writeFileSync(destino, arquivo.buffer);
      limpar();

      res.status(200).json({
        mensagem: "Certificado enviado e validado com sucesso.",
      });
    } catch (error: any) {
      limpar();
      console.error("Erro no upload do certificado:", error?.message || error);
      res
        .status(500)
        .json({ erro: "Erro ao processar o upload do certificado." });
    }
  }

  async iniciar(req: Request, res: Response) {
    try {
      let {
        password,
        clientesSelecionados,
        aliquota,
        service,
        reducao,
        ambiente,
        lastNfe,
        ultimoRps,
      } = req.body;

      // A NFSE passou a exigir o número do RPS: o usuário informa o último
      // usado e as notas saem a partir do seguinte.
      const rpsNumber = proximoNumeroRps(ultimoRps);
      if (rpsNumber === null) {
        res.status(400).json({ erro: "Informe o último número de RPS usado." });
        return;
      }
      this.PASSWORD = password;

      console.log(aliquota);
      console.log(ambiente);

      this.homologacao = ambiente === "homologacao";
      console.log("Servidor Localhost?: " + this.homologacao);

      this.configureProvider(ambiente);
      console.log(this.WSDL_URL);

      aliquota = aliquota?.trim() ? aliquota : "5.0000";
      if (this.homologacao) {
        aliquota = "2.5000";
      }
      aliquota = aliquota.replace(",", ".").replace("%", "");
      if (!service) service = "Servico de Suporte Tecnico";

      if (!reducao) reducao = 60;
      let reducaoStr = String(reducao).replace(",", ".").replace("%", "");
      reducao = Number(reducaoStr) / 100;

      console.log(reducao);

      const job = AppDataSource.getRepository(Jobs).create({
        name: "Gerar Notas NFSe",
        description: "Notas Sendo Geradas em Segundo Plano",
        status: "pendente",
        total: clientesSelecionados.length,
        processados: 0,
      });
      await AppDataSource.getRepository(Jobs).save(job);

      this.processarGeracaoNfseJob(
        job,
        password,
        clientesSelecionados,
        "EnviarLoteRpsSincronoEnvio",
        aliquota,
        ambiente,
        service,
        reducao,
        Number(lastNfe),
        rpsNumber ? Number(rpsNumber) : undefined,
      );

      res.status(200).json({
        message: "Notas Sendo Geradas em Segundo Plano!",
        job: job.id,
      });
    } catch {
      res.status(500).json({ erro: "Erro ao criar o RPS." });
    }
  }

  async processarGeracaoNfseJob(
    job: Jobs,
    password: string,
    ids: string[],
    SOAPAction: string,
    aliquota: string,
    ambiente: string,
    service: string,
    reducao: number,
    lastNfe: number,
    rpsNumber?: number,
  ) {
    const respArr: any[] = [];
    try {
      // Logic for fetching initial NSFE number
      const NsfeData = AppDataSource.getRepository(NFSE);

      // Determine Target Series
      let targetSeries = "1";
      if (ambiente === "homologacao") {
        targetSeries = "wip99";
      } else {
        // Find last used production series (not wip99)
        const lastProd = await NsfeData.findOne({
          where: { serieRps: Not("wip99") },
          order: { id: "DESC" },
        });
        targetSeries = lastProd?.serieRps || "1";
      }

      console.log("Serie alvo: " + targetSeries);

      // Find last RPS for this specific series to determine next number
      let lastRpsForSeries = await NsfeData.findOne({
        where: { serieRps: targetSeries },
        order: { numeroRps: "DESC" },
      });

      console.log("Último RPS no banco local:", lastRpsForSeries);

      const { nextNfseNumber, nextRpsNumber } = await this.getLastNfseNumber(
        lastNfe,
        ambiente,
      );

      console.log("Próximo RPS da API:", nextRpsNumber);
      console.log("Próximo NFSe da API:", nextNfseNumber);

      // CORREÇÃO: Usa o MAIOR número entre banco local e API para evitar duplicação
      let currentRpsNumber = nextRpsNumber;

      if (rpsNumber) {
        console.log(`ℹ️ RPS Number fornecido manualmente: ${rpsNumber}`);
        currentRpsNumber = rpsNumber;
      } else {
        if (lastRpsForSeries && lastRpsForSeries.numeroRps) {
          const localNextRps = lastRpsForSeries.numeroRps + 1;
          console.log("Próximo RPS calculado do banco local:", localNextRps);

          // Se o banco local tem um número maior, usa ele
          if (localNextRps > nextRpsNumber) {
            console.log(
              `⚠️ ATENÇÃO: Banco local tem RPS mais recente (${localNextRps}) que a API (${nextRpsNumber}). Usando ${localNextRps}.`,
            );
            currentRpsNumber = localNextRps;
          }
        }
      }

      // Mirror logic for NFSe number counting
      let currentNfseNumber = nextNfseNumber;

      let nfseBase: any;

      if (!lastRpsForSeries) {
        nfseBase = {};
        nfseBase.tipoRps = 1;
        nfseBase.itemListaServico = "17.01";
        nfseBase.issRetido = 2;
        nfseBase.responsavelRetencao = 1;
        nfseBase.exigibilidadeIss = 1;
        nfseBase.optanteSimplesNacional = 1;
        nfseBase.incentivoFiscal = 2;
      } else {
        // Force clone to plain object to avoid TypeORM reference issues
        nfseBase = { ...lastRpsForSeries };
      }

      if (ambiente == "homologacao") {
        nfseBase.tipoRps = 1;
        nfseBase.itemListaServico = "17.01";

        nfseBase.issRetido = 2;
        nfseBase.responsavelRetencao = 1;
        nfseBase.exigibilidadeIss = 1;
      } else {
        nfseBase.tipoRps = 1;
        nfseBase.itemListaServico = "140201";

        nfseBase.issRetido = 2;
        nfseBase.responsavelRetencao = 1;
        nfseBase.exigibilidadeIss = 1;
      }

      console.log(
        ">>>>> DEBUG ITEM LISTA SEVICO (MODIFICADO): " +
          nfseBase.itemListaServico,
      );

      // Pass targetSeries explicitly to prepareRpsData so it doesn't need to re-guess
      const serieToUse = targetSeries;

      console.log(`Ambiente: ${this.homologacao ? "Homologacao" : "Producao"}`);
      console.log(`Serie Alvo: ${serieToUse}`);
      console.log(`✅ Proximo Numero RPS (FINAL): ${currentRpsNumber}`);
      console.log(`✅ Proximo Numero NFSe (FINAL): ${currentNfseNumber}`);

      let contadorProcessados = 0;
      await AppDataSource.getRepository(Jobs).update(job.id, {
        status: "processando",
        processados: 0,
        total: ids.length,
      });

      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        const dpsDoLote: { id: string; xml: string }[] = [];

        const entitiesToSave: { entidade: NFSE; idDps: string; bid: string }[] =
          [];

        // Process batch
        for (const bid of batch) {
          contadorProcessados++;
          await AppDataSource.getRepository(Jobs).update(job.id, {
            processados: contadorProcessados,
          });
          const {
            xml,
            idDps,
            valorReduzido,
            rpsData,
            ClientData,
            serieRps,
          } = await this.prepareRpsData(
            bid,
            aliquota,
            service,
            reducao,
            currentRpsNumber,
            nfseBase as NFSE,
            serieToUse,
            ambiente,
          );

          // A DPS é assinada no envio do lote
          dpsDoLote.push({ id: idDps, xml });

          // Increment number
          currentRpsNumber++;
          currentNfseNumber++;

          // Create entity but DO NOT SAVE yet
          const novoRegistro = NsfeData.create({
            login: rpsData?.login || "",
            numeroRps: currentRpsNumber - 1,
            serieRps: serieRps || "",
            tipoRps: Number(nfseBase?.tipoRps) || 1, // Enforce 1 even if 0
            dataEmissao: rpsData?.processamento
              ? new Date(rpsData.processamento)
              : new Date(),
            competencia: rpsData?.datavenc
              ? new Date(rpsData.datavenc)
              : new Date(),
            valorServico: valorReduzido || 0,
            aliquota: Number(Number(aliquota).toFixed(4)),
            issRetido: nfseBase?.issRetido || 2, // Default 2 (Não)
            responsavelRetencao: nfseBase?.responsavelRetencao || 1, // Default 1 (Tomador)
            itemListaServico: nfseBase?.itemListaServico,
            discriminacao: service,
            codigoMunicipio: nfseBase?.codigoMunicipio || 0,
            exigibilidadeIss: nfseBase?.exigibilidadeIss || 1, // Default 1 (Exigível)
            cnpjPrestador: nfseBase?.cnpjPrestador || "",
            inscricaoMunicipalPrestador:
              nfseBase?.inscricaoMunicipalPrestador || "",
            cpfTomador: ClientData?.cpf_cnpj.replace(/[^0-9]/g, "") || "",
            razaoSocialTomador: ClientData?.nome || "",
            enderecoTomador: ClientData?.endereco || "",
            numeroEndereco: ClientData?.numero || "",
            complemento: ClientData?.complemento || undefined,
            bairro: ClientData?.bairro || "",
            uf: nfseBase?.uf || "",
            cep: ClientData?.cep.replace(/[^0-9]/g, "") || "",
            telefoneTomador:
              ClientData?.celular.replace(/[^0-9]/g, "") || undefined,
            emailTomador: ClientData?.email || undefined,
            optanteSimplesNacional:
              Number(nfseBase?.optanteSimplesNacional) || 1, // Default 2 (Não)
            incentivoFiscal: Number(nfseBase?.incentivoFiscal) || 2, // Default 2 (Não)
            ambiente: ambiente,
            status: "Ativa",
            numeroNfe: currentNfseNumber - 1,
            modelo: "nacional",
            idDps,
          });
          entitiesToSave.push({ entidade: novoRegistro, idDps, bid });
        }

        // Envia o lote (NFS-e Nacional)
        let envio: Awaited<ReturnType<NFSEController["enviarDpsNacional"]>>;
        try {
          envio = await this.enviarDpsNacional(dpsDoLote, password, ambiente);
        } catch (err: any) {
          console.error("Erro ao enviar o lote de DPS:", err?.message || err);
          for (const bid of batch) {
            respArr.push({
              id: bid,
              success: false,
              error: "Erro na geração do lote",
              detalhes: err?.message || String(err),
            });
          }
          continue;
        }

        // Só vai para o banco a DPS que virou nota.
        for (const item of entitiesToSave) {
          const resultado = envio.porDps.get(item.idDps);

          if (!resultado?.nota) {
            const erros = resultado?.erros || [];
            console.log(
              "DPS recusada:",
              item.idDps,
              erros.length ? resumoMensagens(erros) : "(sem mensagem)",
            );
            respArr.push({
              id: item.bid,
              success: false,
              error: erros.length
                ? "Erro na geração do lote"
                : "Resposta inesperada do servidor",
              detalhes: erros.length
                ? erros.map((m) => ({
                    Codigo: m.codigo,
                    Mensagem: m.mensagem,
                    Correcao: m.correcao,
                  }))
                : envio.responseXml.slice(0, 2000),
            });
            continue;
          }

          item.entidade.chaveNfse = resultado.nota.chave || null;
          if (Number(resultado.nota.numero) > 0) {
            item.entidade.numeroNfe = Number(resultado.nota.numero);
          }

          try {
            await NsfeData.save(item.entidade);
            respArr.push({
              id: item.bid,
              success: true,
              message: "Nota gerada com sucesso",
            });
          } catch (err) {
            console.error("❌ Erro ao salvar entidade no banco:", err);
            respArr.push({
              id: item.bid,
              success: false,
              error: "Erro ao salvar no banco",
              detalhes: err,
            });
          }
        }
      }

      // Cleanup happens automatically or we can force it if provider methods left artifacts (current provider cleanups are handled or minimal)
      // The original code unlinked 'NEW_CERT_PATH' etc, but our provider handles the cert temp file better presumably.
      // If we need to explicitly clean up specific files used by legacy logic:
      const decryptedPath = path.join(
        this.TEMP_DIR,
        "decrypted_certificado.tmp",
      );
      if (fs.existsSync(decryptedPath)) fs.unlinkSync(decryptedPath);

      return respArr;
    } catch (error: any) {
      console.log(error);
      return { status: "500", response: error || "Erro" };
    } finally {
      // --- DEBUG: Log para rastrear o problema ---
      console.log("=== FINALIZANDO JOB ===");
      console.log("Job ID:", job.id);
      console.log("Total de respostas em respArr:", respArr.length);
      console.log("Respostas:", JSON.stringify(respArr, null, 2));

      // Verifica se algum item do array tem success: false
      const teveErro = respArr.some((item) => item.success === false);

      console.log("Teve erro?", teveErro);
      console.log("Status final:", teveErro ? "erro" : "concluido");

      await AppDataSource.getRepository(Jobs).update(job.id, {
        status: teveErro ? "erro" : "concluido",
        resultado: respArr || [],
      });

      console.log("=== JOB ATUALIZADO ===");
    }
  }

  // Refactored helper to prepare data for a single RPS
  private async prepareRpsData(
    id: string,
    aliquota: string,
    service: string,
    reducao: number,
    nfseNumber: number,
    nfseBase: NFSE,
    serieOverride?: string,
    ambiente: string = "producao",
  ) {
    const RPSQuery = MkauthSource.getRepository(Faturas);
    const rpsData = await RPSQuery.findOne({ where: { id: Number(id) } });

    console.log(nfseBase);

    const ClientRepository = MkauthSource.getRepository(ClientesEntities);
    const FaturasRepository = MkauthSource.getRepository(Faturas);
    const FaturasData = await FaturasRepository.findOne({
      where: { id: Number(id) },
    });

    const ClientData = await ClientRepository.findOne({
      where: { login: FaturasData?.login },
    });

    // Fetch IBGE code
    const ibgeId = await codigoIbgeDaCidade(ClientData?.cidade);

    let val = ClientData?.desconto
      ? Number(rpsData?.valor) - Number(ClientData?.desconto)
      : Number(rpsData?.valor);

    // Calc reduced value for display/db
    let valorReduzido = Number(reducao) === 0 ? val : Number(val) * reducao;
    valorReduzido = Number(valorReduzido.toFixed(2));

    // Calc value for XML (original logic applied reduction to 'val' variable)
    val = val * (1 - reducao);
    val = Number(val.toFixed(2));

    const email =
      ambiente === "homologacao"
        ? "suporte_wiptelecom@outlook.com"
        : ClientData?.email && ClientData.email.trim() !== ""
          ? ClientData.email.trim()
          : "sememail@wiptelecom.com.br";

    const cnpjPrestador =
      ambiente === "homologacao"
        ? process.env.MUNICIPIO_CNPJ_TEST
        : process.env.MUNICIPIO_LOGIN;
    const inscricaoPrestador =
      ambiente === "homologacao"
        ? process.env.MUNICIPIO_INCRICAO_TEST
        : process.env.MUNICIPIO_INCRICAO;

    const serieRps = serieOverride
      ? serieOverride
      : ambiente === "homologacao"
        ? "wip99"
        : nfseBase?.serieRps;

    const { id: idDps, xml } = this.nacionalXml.createDpsXml({
      ambiente,
      serie: serieRps,
      numero: nfseNumber,
      codigoMunicipio: CODIGO_MUNICIPIO,
      prestador: {
        cnpj: cnpjPrestador || "",
        inscricaoMunicipal: inscricaoPrestador || "",
        // Contribuinte é optante (erro L124 no ABRASF); homologação não.
        optanteSimples: ambiente === "homologacao" ? "2" : "1",
      },
      tomador: {
        cpfCnpj: ClientData?.cpf_cnpj || "",
        nome: ClientData?.nome || "",
        logradouro: this.removerAcentos(ClientData?.endereco),
        numero: ClientData?.numero || "",
        complemento: ClientData?.complemento || "",
        bairro: ClientData?.bairro || "",
        codigoMunicipio: ibgeId,
        cep: ClientData?.cep?.replace(/[^0-9]/g, "") || "",
        telefone: ClientData?.celular?.replace(/[^0-9]/g, "") || "",
        email,
      },
      servico: {
        itemListaServico: nfseBase?.itemListaServico,
        discriminacao: service,
      },
      valores: {
        valorServicos: val,
        aliquota: Number(aliquota).toFixed(4),
        issRetido: nfseBase?.issRetido || 2, // Default: Retido=2 (Não)
      },
    });

    return {
      xml,
      idDps,
      valorReduzido,
      rpsData,
      ClientData,
      FaturasData,
      nfseBase,
      ibgeId,
      serieRps,
    };
  }

  async imprimirNFSE(req: Request, res: Response) {
    const { id, ambiente } = req.body;
    const nfseRepository = AppDataSource.getRepository(NFSE);

    const result = await Promise.all(
      id.map(async (id: string | number) => {
        const nfse = await nfseRepository.findOne({
          where: { id: Number(id), ambiente },
        });

        if (nfse?.modelo === "nacional") {
          return this.BuscarNfseNacionalDetalhes(nfse, ambiente);
        }
        if (nfse) {
          return this.BuscarNSFEDetalhes(
            nfse.numeroRps,
            nfse.serieRps,
            nfse.tipoRps,
            ambiente,
          );
        }
        return { error: `NFSE ${id} não encontrado no banco de dados.` };
      }),
    );
    console.log(result);

    res.status(200).json(result);
  }

  /**
   * Consulta a NFS-e Nacional (pela chave; sem ela, pelo número/série da DPS)
   * e devolve no mesmo formato da consulta ABRASF, usado na impressão.
   */
  async BuscarNfseNacionalDetalhes(nfse: NFSE, ambiente: string): Promise<any> {
    try {
      this.configureProvider(ambiente);
      const { cnpj, inscricao } = this.prestadorDoAmbiente(ambiente);

      const soapXml = this.nacionalXml.createConsultaSoap({
        cnpj,
        inscricaoMunicipal: inscricao,
        chaveNfse: nfse.chaveNfse,
        numeroDps: nfse.numeroRps,
        serieDps: nfse.serieRps,
      });

      let response: string;
      try {
        response = await this.fiorilliProvider.sendSoapRequest(
          soapXml,
          ACAO_NACIONAL.consultar,
          this.PASSWORD,
        );
      } catch (err: any) {
        if (!err?.response?.data) throw err;
        response = String(err.response.data);
      }

      const [nota] = lerNotas(response);
      if (!nota) {
        const mensagens = lerMensagens(response);
        return {
          status: "error",
          message: mensagens.length
            ? resumoMensagens(mensagens)
            : "NFS-e não encontrada na consulta.",
        };
      }

      // Guarda a chave de notas que ainda não a tinham (ex.: consulta por DPS).
      if (!nfse.chaveNfse && nota.chave) {
        await AppDataSource.getRepository(NFSE).update(nfse.id, {
          chaveNfse: nota.chave,
        });
      }

      const data = notaNacionalNoFormatoAbrasf(
        nota,
        nfse.status === "Cancelada",
      );
      const tomadorEndereco =
        data.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico
          .InfDeclaracaoPrestacaoServico.Tomador.Endereco;
      if (tomadorEndereco.CodigoMunicipio) {
        const ibge = await axios
          .get(
            `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${tomadorEndereco.CodigoMunicipio}`,
            { timeout: 1000 },
          )
          .catch(() => ({ data: { nome: "" } }));
        tomadorEndereco.Cidade = ibge.data?.nome || "";
        tomadorEndereco.Uf =
          ibge.data?.microrregiao?.mesorregiao?.UF?.sigla || nfse.uf || "";
      }
      return { status: "success", data };
    } catch (error: any) {
      return {
        status: "error",
        message: "Erro ao buscar detalhes da NFSE.",
        error: error?.message || error,
      };
    }
  }

  async verificaRps(
    rpsNumber: string | number,
    serie: string | number,
    tipo: string | number,
    ambiente: string,
  ) {
    try {
      const cnpj =
        ambiente === "homologacao"
          ? process.env.MUNICIPIO_CNPJ_TEST
          : process.env.MUNICIPIO_LOGIN;
      const inscricao =
        ambiente === "homologacao"
          ? process.env.MUNICIPIO_INCRICAO_TEST
          : process.env.MUNICIPIO_INCRICAO;

      const envioXml = this.xmlFactory.createConsultaNfseRpsEnvio(
        rpsNumber,
        String(serie),
        String(tipo),
        cnpj || "",
        inscricao || "",
      );
      const soapFinal = this.xmlFactory.createConsultaNfseSoap(
        envioXml,
        process.env.MUNICIPIO_LOGIN || "",
        process.env.MUNICIPIO_SENHA || "",
      );

      this.configureProvider(ambiente); // Ensure correct wsdl
      const response = await this.legacyProvider.sendSoapRequest(
        soapFinal,
        "ConsultarNfseServicoPrestadoEnvio",
        this.PASSWORD,
      );

      if (response && response.includes("<ns2:Codigo>E92</ns2:Codigo>"))
        return true;
      return false;
    } catch {
      return false;
    }
  }

  async cancelarNfse(req: Request, res: Response) {
    try {
      const { id, password, ambiente } = req.body;
      if (!Array.isArray(id)) {
        res.status(400).json({ error: "id must be an array" });
        return;
      }
      this.PASSWORD = password;
      this.configureProvider(ambiente);

      const job = AppDataSource.getRepository(Jobs).create({
        name: "Cancelar Notas NFSe",
        description: "Notas Sendo Canceladas em Segundo Plano",
        status: "pendente",
        total: id.length,
        processados: 0,
      });
      await AppDataSource.getRepository(Jobs).save(job);

      this.processarCancelamentoNfseJob(job, id, password, ambiente);

      res.status(200).json({
        message: "Cancelamento em andamento!",
        job: job.id,
      });
    } catch {
      res.status(500).json({ error: "Internal Server Error" });
    }
  }

  async processarCancelamentoNfseJob(
    job: Jobs,
    ids: (string | number)[],
    password: string,
    ambiente: string,
  ) {
    const responses: any[] = [];
    try {
      this.PASSWORD = password;
      this.configureProvider(ambiente);
      const nfseRepository = AppDataSource.getRepository(NFSE);

      await AppDataSource.getRepository(Jobs).update(job.id, {
        status: "processando",
        processados: 0,
        total: ids.length,
      });

      let contador = 0;

      for (const nfseId of ids) {
        contador++;
        await AppDataSource.getRepository(Jobs).update(job.id, {
          processados: contador,
        });

        try {
          const nfseEntity = await nfseRepository.findOne({
            where: { id: Number(nfseId), ambiente },
          });

          if (!nfseEntity) {
            responses.push({
              id: nfseId,
              success: false,
              error: "NFShe not found",
            });
            continue;
          }

          if (nfseEntity.modelo === "nacional") {
            responses.push(
              await this.cancelarNfseNacional(nfseEntity, password, ambiente),
            );
            continue;
          }

          // Notas antigas (ABRASF): cancelamento pelo web service antigo.
          const rps = nfseEntity.numeroRps;

          const nfseNumber = await this.setNfseNumber(
            rps,
            nfseEntity?.serieRps || "1",
            nfseEntity?.tipoRps || "1",
            ambiente,
          );
          if (!nfseNumber)
            throw new Error("NFSe Number not found for RPS " + rps);

          const cnpj =
            ambiente === "homologacao"
              ? process.env.MUNICIPIO_CNPJ_TEST
              : process.env.MUNICIPIO_LOGIN;
          const inscricao =
            ambiente === "homologacao"
              ? process.env.MUNICIPIO_INCRICAO_TEST
              : process.env.MUNICIPIO_INCRICAO;

          const pedidoXml = this.xmlFactory.createPedidoCancelamentoXml(
            nfseNumber,
            cnpj || "",
            inscricao || "",
            "3503406",
          );
          const envioXml = `<CancelarNfseEnvio xmlns="http://www.abrasf.org.br/nfse.xsd">${pedidoXml}</CancelarNfseEnvio>`;

          const envioXmlAssinado = this.legacyProvider.assinarXml(
            envioXml,
            "InfPedidoCancelamento",
            password,
          );

          const soapFinal = this.xmlFactory.createCancelamentoSoap(
            envioXmlAssinado,
            process.env.MUNICIPIO_LOGIN || "",
            process.env.MUNICIPIO_SENHA || "",
          );

          let soapToSend = soapFinal;

          const response = await this.legacyProvider.sendSoapRequest(
            soapToSend,
            "ConsultarNfseServicoPrestadoEnvio",
            password,
          );

          const result = await parseStringPromise(response, {
            explicitArray: false,
          });

          const soapBody =
            result["soap:Envelope"]?.["soap:Body"] || result["soapenv:Body"];
          const cancelarResp =
            soapBody?.["ns3:cancelarNfseResponse"] ||
            soapBody?.["cancelarNfseResponse"] ||
            soapBody?.["CancelarNfseResposta"];
          const respostaInterna =
            cancelarResp?.["ns2:CancelarNfseResposta"] ||
            cancelarResp?.["CancelarNfseResposta"];

          // Se tiver ListaMensagemRetorno, é erro!
          if (
            respostaInterna &&
            (respostaInterna["ns2:ListaMensagemRetorno"] ||
              respostaInterna["ListaMensagemRetorno"])
          ) {
            const erroMsg =
              respostaInterna["ns2:ListaMensagemRetorno"]?.[
                "ns2:MensagemRetorno"
              ] || respostaInterna["ListaMensagemRetorno"]?.["MensagemRetorno"];

            console.error("ERRO AO CANCELAR NFSe " + nfseId + ":", erroMsg);

            // Adiciona ao array de responses para que o finally possa avaliar corretamente
            responses.push({
              id: nfseId,
              success: false,
              error: "Prefeitura rejeitou o cancelamento",
              detalhes: erroMsg,
            });

            // Continua para processar os próximos itens
            continue;
          }

          nfseEntity.status = "Cancelada";
          await nfseRepository.save(nfseEntity);

          console.log(response);

          responses.push({ id: nfseId, success: true, response: response });
        } catch (error) {
          responses.push({ id: nfseId, success: false, error });
        }
      }
    } catch (e) {
      console.log(e);
    } finally {
      // --- DEBUG: Log para rastrear o problema ---
      // console.log("=== FINALIZANDO JOB DE CANCELAMENTO ===");
      // console.log("Job ID:", job.id);
      // console.log("Total de respostas:", responses.length);
      // console.log("Respostas:", JSON.stringify(responses, null, 2));

      // Verifica se algum item do array tem success: false
      const teveErro = responses.some((item) => item.success === false);

      // console.log("Teve erro?", teveErro);
      // console.log("Status final:", teveErro ? "erro" : "concluido");

      await AppDataSource.getRepository(Jobs).update(job.id, {
        status: teveErro ? "erro" : "concluido",
        resultado: responses || [],
      });

      return responses;

      console.log("=== JOB DE CANCELAMENTO ATUALIZADO ===");
    }
  }

  /**
   * Cancelamento na NFS-e Nacional: evento 101101 sobre a chave de acesso.
   * Nota sem chave guardada tem a chave buscada antes pela consulta da DPS.
   */
  private async cancelarNfseNacional(
    nfseEntity: NFSE,
    password: string,
    ambiente: string,
  ): Promise<any> {
    const nfseRepository = AppDataSource.getRepository(NFSE);
    const { cnpj, inscricao } = this.prestadorDoAmbiente(ambiente);

    let chave = nfseEntity.chaveNfse;
    if (!chave) {
      const detalhes = await this.BuscarNfseNacionalDetalhes(
        nfseEntity,
        ambiente,
      );
      chave =
        detalhes?.data?.CompNfse?.Nfse?.InfNfse?.CodigoVerificacao || null;
      if (!chave) {
        return {
          id: nfseEntity.id,
          success: false,
          error: "Chave da NFS-e não encontrada",
          detalhes: detalhes?.message,
        };
      }
    }

    const pedido = this.nacionalXml.createPedidoCancelamentoXml({
      ambiente,
      chaveNfse: chave,
      cnpjAutor: cnpj,
      inscricaoMunicipal: inscricao,
    });
    const pedidoAssinado = this.fiorilliProvider.assinarXml(
      pedido,
      "infPedReg",
      password,
    );
    const soapXml = this.nacionalXml.createCancelamentoSoap(pedidoAssinado);

    let response: string;
    try {
      response = await this.fiorilliProvider.sendSoapRequest(
        soapXml,
        ACAO_NACIONAL.cancelar,
        password,
      );
    } catch (err: any) {
      if (!err?.response?.data) {
        return {
          id: nfseEntity.id,
          success: false,
          error: err?.message || "Erro ao enviar o cancelamento",
        };
      }
      response = String(err.response.data);
    }

    const mensagens = lerMensagens(response);
    const status = lerStatus(response);
    const recebido = /CancelarNFSeResposta/.test(response);
    const confirmado = /sucesso|cancelad|homologad|^100$|^1$/i.test(status);

    if (!recebido || (mensagens.length > 0 && !confirmado)) {
      console.error(
        "ERRO AO CANCELAR NFSe " + nfseEntity.id + ":",
        resumoMensagens(mensagens) || response,
      );
      return {
        id: nfseEntity.id,
        success: false,
        error: "Prefeitura rejeitou o cancelamento",
        detalhes: mensagens.length
          ? mensagens.map((m) => ({
              Codigo: m.codigo,
              Mensagem: m.mensagem,
              Correcao: m.correcao,
            }))
          : String(response).slice(0, 2000),
      };
    }

    nfseEntity.status = "Cancelada";
    nfseEntity.chaveNfse = chave;
    await nfseRepository.save(nfseEntity);

    return { id: nfseEntity.id, success: true, response };
  }

  async setPassword(req: Request, res: Response) {
    const { password } = req.body;
    this.PASSWORD = password;
    res.status(200).json({ error: "Sucesso" });
  }

  async setNfseNumber(
    rpsNumber: string | number,
    serie: string | number = "1",
    tipo: string | number = "1",
    ambiente: string,
  ) {
    try {
      console.log(rpsNumber);

      const cnpj =
        ambiente === "homologacao"
          ? process.env.MUNICIPIO_CNPJ_TEST
          : process.env.MUNICIPIO_LOGIN;
      const inscricao =
        ambiente === "homologacao"
          ? process.env.MUNICIPIO_INCRICAO_TEST
          : process.env.MUNICIPIO_INCRICAO;

      const envioXml = this.xmlFactory.createConsultaNfseRpsEnvio(
        rpsNumber,
        String(serie),
        String(tipo),
        cnpj || "",
        inscricao || "",
      );
      const soapFinal = this.xmlFactory.createConsultaNfseSoap(
        envioXml,
        process.env.MUNICIPIO_LOGIN || "",
        process.env.MUNICIPIO_SENHA || "",
      );

      this.configureProvider(ambiente);
      const response = await this.legacyProvider.sendSoapRequest(
        soapFinal,
        "ConsultarNfseServicoPrestadoEnvio",
        this.PASSWORD,
      );

      console.log(response);

      console.log("Setado Status NFSE: RPS: " + rpsNumber);

      const parsed = await parseStringPromise(response, {
        explicitArray: false,
      });

      const compNfse =
        parsed?.["soap:Envelope"]?.["soap:Body"]?.[
          "ns3:consultarNfsePorRpsResponse"
        ]?.["ns2:ConsultarNfseRpsResposta"]?.["ns2:CompNfse"];

      // If CompNfse is array (multiple results?), take first
      const nfseNode = Array.isArray(compNfse) ? compNfse[0] : compNfse;

      const numeroNfse =
        nfseNode?.["ns2:Nfse"]?.["ns2:InfNfse"]?.["ns2:Numero"];

      if (numeroNfse) return numeroNfse;
      return null;
    } catch (error) {
      return error;
    }
  }

  async setNfseStatus(
    rpsNumber: string | number,
    serie: string | number = "1",
    tipo: string | number = "1",
    ambiente: string,
  ) {
    try {
      const cnpj =
        ambiente === "homologacao"
          ? process.env.MUNICIPIO_CNPJ_TEST
          : process.env.MUNICIPIO_LOGIN;
      const inscricao =
        ambiente === "homologacao"
          ? process.env.MUNICIPIO_INCRICAO_TEST
          : process.env.MUNICIPIO_INCRICAO;

      const envioXml = this.xmlFactory.createConsultaNfseRpsEnvio(
        rpsNumber,
        String(serie),
        String(tipo),
        cnpj || "",
        inscricao || "",
      );
      const soapFinal = this.xmlFactory.createConsultaNfseSoap(
        envioXml,
        process.env.MUNICIPIO_LOGIN || "",
        process.env.MUNICIPIO_SENHA || "",
      );

      this.configureProvider(ambiente);
      const response = await this.legacyProvider.sendSoapRequest(
        soapFinal,
        "ConsultarNfseServicoPrestadoEnvio",
        this.PASSWORD,
      );

      if (response.includes('<ns2:NfseCancelamento versao="2.0">')) return true;
      return false;
    } catch {
      return false;
    }
  }

  async BuscarNSFE(req: Request, res: Response) {
    try {
      const { cpf, filters, dateFilter, ambiente, status, numeroNfse } =
        req.body;
      const w: any = {};
      if (cpf) w.cpf_cnpj = Like(`%${cpf}%`);
      if (filters) {
        const { plano, vencimento, cli_ativado, nova_nfe } = filters;
        if (plano?.length) w.plano = In(plano);
        if (vencimento?.length) w.venc = In(vencimento);
        if (cli_ativado?.length) w.cli_ativado = In(["s"]);
        if (nova_nfe?.length) w.tags = In(nova_nfe);
      }
      const ClientRepository = MkauthSource.getRepository(ClientesEntities);
      const clientesResponse = await ClientRepository.find({
        where: w,
        select: { login: true, cpf_cnpj: true, cli_ativado: true },
      });
      const startDate = dateFilter
        ? moment(dateFilter.start).startOf("day").format("YYYY-MM-DD HH:mm:ss")
        : moment().startOf("month").format("YYYY-MM-DD HH:mm:ss");

      const endDate = dateFilter
        ? moment(dateFilter.end).endOf("day").format("YYYY-MM-DD HH:mm:ss")
        : moment().endOf("month").format("YYYY-MM-DD HH:mm:ss");

      console.log(startDate, endDate);

      const numeroNfseStr = (numeroNfse ?? "").toString().trim();

      const nfseData = AppDataSource.getRepository(NFSE);
      const nfseResponse = await nfseData.find({
        where: {
          login: In(clientesResponse.map((c) => c.login)),
          timestamp: Between(startDate, endDate) as any,
          ambiente: ambiente,
          status: status,
          ...(numeroNfseStr
            ? {
                numeroNfe: Raw(
                  (alias) => `CAST(${alias} AS CHAR) LIKE :nfseNum`,
                  { nfseNum: `%${numeroNfseStr}%` },
                ),
              }
            : {}),
        },
        order: { id: "DESC" },
      });
      const arr = await Promise.all(
        clientesResponse.map(async (c) => {
          const nfseDoCliente = nfseResponse.filter(
            (nf) => nf.login === c.login,
          );

          const nfseValidas: typeof nfseDoCliente = [];
          const nfseNumberArray: string[] = [];

          for (const nf of nfseDoCliente) {
            // const isCancelada = await this.setNfseStatus(
            //   nf.numeroRps,
            //   nf.serieRps,
            //   nf.tipoRps,
            //   ambiente
            // );
            // if (isCancelada) {
            //   nf.status = "Cancelada";
            // }

            nfseValidas.push(nf);
          }

          if (!nfseValidas.length) return null;

          return {
            ...c,
            nfse: {
              id: nfseValidas.map((nf) => nf.id).join(", "),
              login: nfseValidas.map((nf) => nf.login).join(", ") || null,
              numero_rps:
                nfseValidas.map((nf) => nf.numeroRps).join(", ") || null,
              serie_rps:
                nfseValidas.map((nf) => nf.serieRps).join(", ") || null,
              tipo_rps: nfseValidas.map((nf) => nf.tipoRps).join(", ") || null,
              data_emissao:
                nfseValidas
                  .map((nf) =>
                    moment
                      .tz(nf.dataEmissao, "America/Sao_Paulo")
                      .format("DD/MM/YYYY"),
                  )
                  .join(", ") || null,
              competencia:
                nfseValidas
                  .map((nf) =>
                    moment
                      .tz(nf.competencia, "America/Sao_Paulo")
                      .format("DD/MM/YYYY"),
                  )
                  .join(", ") || null,
              valor_servico:
                nfseValidas.map((nf) => nf.valorServico).join(", ") || null,
              aliquota: nfseValidas.map((nf) => nf.aliquota).join(", ") || null,
              iss_retido:
                nfseValidas.map((nf) => nf.issRetido).join(", ") || null,
              responsavel_retecao:
                nfseValidas.map((nf) => nf.responsavelRetencao).join(", ") ||
                null,
              item_lista_servico:
                nfseValidas.map((nf) => nf.itemListaServico).join(", ") || null,
              discriminacao:
                nfseValidas.map((nf) => nf.discriminacao).join(", ") || null,
              codigo_municipio:
                nfseValidas.map((nf) => nf.codigoMunicipio).join(", ") || null,
              exigibilidade_iss:
                nfseValidas.map((nf) => nf.exigibilidadeIss).join(", ") || null,
              cnpj_prestador:
                nfseValidas.map((nf) => nf.cnpjPrestador).join(", ") || null,
              inscricao_municipal_prestador:
                nfseValidas
                  .map((nf) => nf.inscricaoMunicipalPrestador)
                  .join(", ") || null,
              cpf_tomador:
                nfseValidas.map((nf) => nf.cpfTomador).join(", ") || null,
              razao_social_tomador:
                nfseValidas.map((nf) => nf.razaoSocialTomador).join(", ") ||
                null,
              endereco_tomador:
                nfseValidas.map((nf) => nf.enderecoTomador).join(", ") || null,
              numero_endereco:
                nfseValidas.map((nf) => nf.numeroEndereco).join(", ") || null,
              complemento:
                nfseValidas.map((nf) => nf.complemento).join(", ") || null,
              bairro: nfseValidas.map((nf) => nf.bairro).join(", ") || null,
              uf: nfseValidas.map((nf) => nf.uf).join(", ") || null,
              cep: nfseValidas.map((nf) => nf.cep).join(", ") || null,
              telefone_tomador:
                nfseValidas.map((nf) => nf.telefoneTomador).join(", ") || null,
              email_tomador:
                nfseValidas.map((nf) => nf.emailTomador).join(", ") || null,
              optante_simples_nacional:
                nfseValidas.map((nf) => nf.optanteSimplesNacional).join(", ") ||
                null,
              incentivo_fiscal:
                nfseValidas.map((nf) => nf.incentivoFiscal).join(", ") || null,
              status: nfseValidas.map((nf) => nf.status).join(", ") || null,
              numeroNfse:
                nfseValidas.map((nf) => nf.numeroNfe).join(", ") || null,
              timestamp:
                nfseValidas.map((nf) => nf.timestamp).join(", ") || null,
            },
          };
        }),
      );
      const filtered = arr
        .filter((i): i is NonNullable<typeof i> => i !== null)
        .sort((a, b) => (b?.nfse?.id || "").localeCompare(a?.nfse?.id || ""));
      res.status(200).json(filtered);
    } catch {
      res.status(500).json({ error: "Internal Server Error" });
    }
  }

  async BuscarNSFEDetalhes(
    rpsNumber: string | number,
    serie: string | number,
    tipo: string | number,
    ambiente: string,
    retryCount: number = 0,
  ): Promise<any> {
    try {
      const cnpj =
        ambiente === "homologacao"
          ? process.env.MUNICIPIO_CNPJ_TEST
          : process.env.MUNICIPIO_LOGIN;
      const inscricao =
        ambiente === "homologacao"
          ? process.env.MUNICIPIO_INCRICAO_TEST
          : process.env.MUNICIPIO_INCRICAO;

      console.log(ambiente);

      this.configureProvider(ambiente);

      const envioXml = this.xmlFactory.createConsultaNfseRpsEnvio(
        rpsNumber,
        String(serie),
        String(tipo),
        cnpj || "",
        inscricao || "",
      );
      const soapFinal = this.xmlFactory.createConsultaNfseSoap(
        envioXml,
        process.env.MUNICIPIO_LOGIN || "",
        process.env.MUNICIPIO_SENHA || "",
      );

      const response = await this.legacyProvider.sendSoapRequest(
        soapFinal,
        "ConsultarNfseServicoPrestadoEnvio",
        this.PASSWORD,
      );

      // Check for E92 - RPS not converted
      // if (response && response.includes("<ns2:Codigo>E92</ns2:Codigo>")) {
      //   console.log(
      //     `[BuscarNSFEDetalhes] RPS ${rpsNumber} ainda não convertido (E92). Tentativa ${
      //       retryCount + 1
      //     }/10. Aguardando...`
      //   );
      //   // if (retryCount < 10) {
      //   //   await new Promise((resolve) => setTimeout(resolve, 3000));
      //   //   return this.BuscarNSFEDetalhes(
      //   //     rpsNumber,
      //   //     serie,
      //   //     tipo,
      //   //     retryCount + 1
      //   //   );
      //   // }
      // }

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(response, "text/xml");
      const nfseNodes = xmlDoc.getElementsByTagName("ns2:CompNfse");
      if (nfseNodes.length > 0) {
        const nfseNode = nfseNodes[0];
        const extractedData: Record<string, any> = {};
        const extractChildren = (node: Element) => {
          const r: Record<string, any> = {};
          for (let i = 0; i < node.childNodes.length; i++) {
            const c = node.childNodes[i];
            if (c.nodeType === 1) {
              const el = c as Element;
              const k = el.localName;
              const txt = el.textContent?.trim() || "";
              if (
                el.childNodes.length > 0 &&
                Array.from(el.childNodes).some((a) => a.nodeType === 1)
              )
                r[k] = extractChildren(el);
              else r[k] = txt;
            }
          }
          return r;
        };
        extractedData[nfseNode.localName] = extractChildren(nfseNode);
        const uf =
          extractedData.CompNfse?.Nfse?.InfNfse?.DeclaracaoPrestacaoServico
            ?.InfDeclaracaoPrestacaoServico?.Tomador?.Endereco?.CodigoMunicipio;
        if (uf) {
          const ibgeResponse = await axios
            .get(
              `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${uf}`,
              { timeout: 1000 },
            )
            .catch(() => ({ data: { nome: "" } }));
          extractedData.CompNfse.Nfse.InfNfse.DeclaracaoPrestacaoServico.InfDeclaracaoPrestacaoServico.Tomador.Endereco.Cidade =
            ibgeResponse.data.nome;
        }
        return { status: "success", data: extractedData };
      } else {
        return {
          status: "error",
          message: "InfNfse element not found in XML.",
        };
      }
    } catch (error) {
      return {
        status: "error",
        message: "Erro ao buscar detalhes da NFSE.",
        error,
      };
    }
  }

  async getLastNfseNumber(
    lastNfe: number,
    ambiente: string = "producao",
  ): Promise<{ nextNfseNumber: number; nextRpsNumber: number }> {
    try {
      this.configureProvider(ambiente);

      const cnpj =
        ambiente === "homologacao"
          ? process.env.MUNICIPIO_CNPJ_TEST
          : process.env.MUNICIPIO_LOGIN;
      const inscricao =
        ambiente === "homologacao"
          ? process.env.MUNICIPIO_INCRICAO_TEST
          : process.env.MUNICIPIO_INCRICAO;

      const envioXml =
        this.xmlFactory.createConsultarNfseServicoPrestadoPorNumeroEnvio(
          cnpj || "",
          inscricao || "",
          lastNfe,
        );

      const soapXml = this.xmlFactory.createConsultarNfseServicoPrestadoSoap(
        envioXml,
        process.env.MUNICIPIO_LOGIN || "",
        process.env.MUNICIPIO_SENHA || "",
      );

      console.log("SOAP Request getLastNfseNumber:", soapXml);

      const response = await this.legacyProvider.sendSoapRequest(
        soapXml,
        "ConsultarNfseServicoPrestadoEnvio", // Action per doc
        this.PASSWORD,
      );

      const parsed = await parseStringPromise(response, {
        explicitArray: false,
      });

      const listaMensagem =
        parsed?.["soap:Envelope"]?.["soap:Body"]?.[
          "ns3:consultarNfseServicoPrestadoResponse"
        ]?.["ns2:ConsultarNfseServicoPrestadoResposta"]?.[
          "ns2:ListaMensagemRetorno"
        ];

      if (listaMensagem) {
        console.log(
          "Mensagem Retorno getLastNfseNumber:",
          JSON.stringify(listaMensagem),
        );
      }

      const compNfse =
        parsed?.["soap:Envelope"]?.["soap:Body"]?.[
          "ns3:consultarNfseServicoPrestadoResponse"
        ]?.["ns2:ConsultarNfseServicoPrestadoResposta"]?.["ns2:ListaNfse"]?.[
          "ns2:CompNfse"
        ];

      if (!compNfse) {
        console.log("Nenhuma NFSe encontrada. Retornando 1.");
        return { nextNfseNumber: 1, nextRpsNumber: 1 };
      }

      const lista = Array.isArray(compNfse) ? compNfse : [compNfse];
      console.log("getLastNfseNumber items:", JSON.stringify(lista));

      let foundNextNfse = null;
      let foundNextRps = null;

      for (const item of lista) {
        const nfseNum = item?.["ns2:Nfse"]?.["ns2:InfNfse"]?.["ns2:Numero"];
        const rpsObj =
          item?.["ns2:Nfse"]?.["ns2:InfNfse"]?.[
            "ns2:DeclaracaoPrestacaoServico"
          ]?.["ns2:InfDeclaracaoPrestacaoServico"]?.["ns2:Rps"]?.[
            "ns2:IdentificacaoRps"
          ];

        const rpsNum = rpsObj?.["ns2:Numero"];
        const rpsSerie = rpsObj?.["ns2:Serie"];

        console.log(
          `Checking item: NFSe=${nfseNum}, RPS=${rpsNum}, Serie=${rpsSerie}`,
        );

        if (nfseNum && Number(nfseNum) === lastNfe) {
          console.log(
            `NFSe ${lastNfe} encontrada. RPS vinculado: ${rpsNum} (Serie: ${rpsSerie}).`,
          );
          // Preferentially update if we find a match, but keep looking (or break if unique)
          // Assuming we want the one matching our current series logic?
          foundNextNfse = lastNfe + 1;
          foundNextRps = Number(rpsNum) + 1;
        }
      }

      if (foundNextNfse && foundNextRps) {
        console.log(
          `Retornando: NextNFe=${foundNextNfse}, NextRPS=${foundNextRps}`,
        );
        return {
          nextNfseNumber: foundNextNfse,
          nextRpsNumber: foundNextRps,
        };
      }

      console.log(
        `NFSe ${lastNfe} não encontrada explicitamente. Retornando fallback: ${
          lastNfe + 1
        }`,
      );
      return { nextNfseNumber: lastNfe + 1, nextRpsNumber: 1 };
    } catch (error) {
      console.error("Erro ao buscar último número de RPS:", error);
      return { nextNfseNumber: 1, nextRpsNumber: 1 };
    }
  }

  removerAcentos(texto: any): string {
    if (!texto) return "";
    return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  async BuscarClientes(req: Request, res: Response) {
    const { cpf, filters, dateFilter } = req.body;
    const ClientRepository = MkauthSource.getRepository(ClientesEntities);
    const w: any = {};
    let servicosFilter: string[] = ["mensalidade"];
    if (cpf) w.cpf_cnpj = Like(`%${cpf}%`);
    if (filters) {
      let { plano, vencimento, cli_ativado, SCM, servicos } = filters;
      if (plano?.length) w.plano = In(plano);
      if (vencimento?.length) w.venc = In(vencimento);
      if (cli_ativado?.length) w.cli_ativado = In(["s"]);
      if (SCM?.length) {
        w.vendedor = In(SCM);
      } else {
        w.vendedor = In(["SVA"]);
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

  public async GerarNfseAvulsa(req: Request, res: Response) {
    try {
      const {
        login,
        valor,
        servico,
        descricao,
        password,
        nfeNumber,
        ambiente,
        aliquota,
        ultimoRps,
      } = req.body;

      console.log("GerarNfseAvulsa Payload:", JSON.stringify(req.body));
      console.log("nfeNumber recebido:", nfeNumber, "Tipo:", typeof nfeNumber);

      if (!login || !valor || !servico || !password) {
        res.status(400).json({ error: "Dados incompletos" });
        return;
      }

      // A NFSE exige o RPS: o usuário informa o último usado e a nota sai com
      // o seguinte.
      const rpsNumber = proximoNumeroRps(ultimoRps);
      if (rpsNumber === null) {
        res.status(400).json({ error: "Informe o último número de RPS usado." });
        return;
      }

      this.PASSWORD = password;
      this.configureProvider(ambiente);

      const ClientRepository = MkauthSource.getRepository(ClientesEntities);
      const ClientData = await ClientRepository.findOne({ where: { login } });

      if (!ClientData) {
        res.status(404).json({ error: "Cliente não encontrado" });
        return;
      }

      let nextNfseNumber = 0;
      let nextRpsNumber = 0;

      const NsfeData = AppDataSource.getRepository(NFSE); // Moved up for use in if (nfeNumber) block
      let currentRpsNumber = 0;
      let targetSeries = "1";

      if (!rpsNumber) {
        const result = await this.getLastNfseNumber(
          Number(nfeNumber),
          ambiente,
        );
        nextNfseNumber = result.nextNfseNumber;
        nextRpsNumber = result.nextRpsNumber;

        console.log("nextNfseNumber:", nextNfseNumber);
        console.log("nextRpsNumber:", nextRpsNumber);

        const lastProd = await NsfeData.findOne({
          where: { serieRps: Not("wip99") },
          order: { id: "DESC" },
        });
        targetSeries = lastProd?.serieRps || "1";

        const lastRpsForSeries = await NsfeData.findOne({
          where: { serieRps: targetSeries },
          order: { numeroRps: "DESC" },
        });

        currentRpsNumber = nextRpsNumber;
      } else {
        currentRpsNumber = Number(rpsNumber);
        const result = await this.getLastNfseNumber(
          Number(nfeNumber),
          ambiente,
        );
        nextNfseNumber = result.nextNfseNumber;

        console.log("nextNfseNumber:", nextNfseNumber);
        console.log("nextRpsNumber:", nextRpsNumber);

        const lastProd = await NsfeData.findOne({
          where: { serieRps: Not("wip99") },
          order: { id: "DESC" },
        });
        targetSeries = lastProd?.serieRps || "1";
      }

      const ibgeId = await codigoIbgeDaCidade(ClientData?.cidade);

      const email =
        ClientData?.email && ClientData.email.trim() !== ""
          ? ClientData.email.trim()
          : "sememail@wiptelecom.com.br";

      const cnpjPrestador =
        ambiente === "producao"
          ? process.env.MUNICIPIO_LOGIN
          : process.env.MUNICIPIO_CNPJ_TEST;
      const inscricaoPrestador =
        ambiente === "producao"
          ? process.env.MUNICIPIO_INCRICAO
          : process.env.MUNICIPIO_INCRICAO_TEST;

      const dps = this.nacionalXml.createDpsXml({
        ambiente,
        serie: targetSeries,
        numero: currentRpsNumber,
        codigoMunicipio: CODIGO_MUNICIPIO,
        prestador: {
          cnpj: cnpjPrestador || "",
          inscricaoMunicipal: inscricaoPrestador || "",
          optanteSimples: "1",
        },
        tomador: {
          cpfCnpj: ClientData?.cpf_cnpj || "",
          nome: this.removerAcentos(ClientData?.nome || ""),
          logradouro: this.removerAcentos(ClientData?.endereco || ""),
          numero: ClientData?.numero || "",
          complemento: this.removerAcentos(ClientData?.complemento || ""),
          bairro: this.removerAcentos(ClientData?.bairro || ""),
          codigoMunicipio: ibgeId,
          cep: ClientData?.cep?.replace(/[^0-9]/g, "") || "",
          telefone: ClientData?.celular?.replace(/[^0-9]/g, "") || "",
          email,
        },
        servico: {
          itemListaServico: servico,
          discriminacao: this.removerAcentos(descricao || "Servico Avulso"),
        },
        valores: {
          valorServicos: Number(valor),
          aliquota,
          issRetido: 2,
        },
      });

      let envio: Awaited<ReturnType<NFSEController["enviarDpsNacional"]>>;
      try {
        envio = await this.enviarDpsNacional(
          [dps],
          password,
          ambiente,
        );
      } catch (error: any) {
        console.error("Erro ao enviar a DPS:", error?.message || error);
        res.status(500).json({
          error: "Erro no Servidor SOAP",
          detalhes: error?.message || String(error),
        });
        return;
      }

      const resultado = envio.porDps.get(dps.id);
      const temSucesso = resultado?.nota;
      const temErro = resultado?.erros.length
        ? resultado.erros.map((m) => ({
            Codigo: m.codigo,
            Mensagem: m.mensagem,
            Correcao: m.correcao,
          }))
        : null;

      if (temSucesso) {
        const novoRegistro = NsfeData.create({
          login: login,
          numeroRps: currentRpsNumber,
          serieRps: targetSeries,
          tipoRps: 1,
          dataEmissao: new Date(),
          competencia: new Date(),
          valorServico: Number(valor),
          aliquota: aliquota,
          issRetido: 2,
          responsavelRetencao: 1,
          itemListaServico: servico,
          discriminacao: descricao || "Serviço Avulso",
          codigoMunicipio: 0,
          exigibilidadeIss: 1,
          cnpjPrestador: cnpjPrestador || "",
          inscricaoMunicipalPrestador: inscricaoPrestador || "",
          cpfTomador: ClientData?.cpf_cnpj.replace(/[^0-9]/g, "") || "",
          razaoSocialTomador: ClientData?.nome || "",
          enderecoTomador: ClientData?.endereco || "",
          numeroEndereco: ClientData?.numero || "",
          complemento: ClientData?.complemento || undefined,
          bairro: ClientData?.bairro || "",
          uf: "SP",
          cep: ClientData?.cep.replace(/[^0-9]/g, "") || "",
          telefoneTomador:
            ClientData?.celular.replace(/[^0-9]/g, "") || undefined,
          emailTomador: email,
          optanteSimplesNacional: 1,
          incentivoFiscal: 2,
          ambiente: ambiente,
          status: "Ativa",
          numeroNfe: Number(temSucesso.numero) || nextNfseNumber,
          modelo: "nacional",
          chaveNfse: temSucesso.chave || null,
          idDps: dps.id,
        });
        await NsfeData.save(novoRegistro);
        res.status(200).json({
          message: "NFSE Gerada com Sucesso",
          detalhes: { numero: temSucesso.numero, chave: temSucesso.chave },
        });
      } else {
        res.status(400).json({
          error: "Erro ao gerar NFSE",
          detalhes: temErro || envio.responseXml.slice(0, 2000),
        });
      }
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erro interno" });
    }
  }

  public BuscarClientesServicos = async (req: Request, res: Response) => {
    try {
      const { cpf, cidade, ativo } = (req.body || {}) as {
        cpf?: string;
        cidade?: string;
        ativo?: string;
      };

      const params: any[] = [];
      const where: string[] = [];
      where.push(`${sqlTagServico("sc.nome")} IN ('STREAMER', 'CAMERA')`);
      if (cpf) {
        const cpfDigits = String(cpf).replace(/\D/g, "");
        if (cpfDigits) {
          where.push(
            "REPLACE(REPLACE(REPLACE(c.cpf_cnpj,'.',''),'-',''),'/','') LIKE ?",
          );
          params.push(`%${cpfDigits}%`);
        }
      }
      if (cidade) {
        where.push("UPPER(c.cidade) LIKE ?");
        params.push(`%${String(cidade).toUpperCase()}%`);
      }
      if (ativo === "s" || ativo === "n") {
        where.push("c.cli_ativado = ?");
        params.push(ativo);
      }

      const sql = `
        SELECT
          c.login,
          c.nome,
          c.email,
          c.cidade,
          c.cpf_cnpj,
          c.cli_ativado,
          SUM(CASE WHEN ${sqlTagServico("sc.nome")} = 'STREAMER' THEN 1 ELSE 0 END) AS qtd_streamer,
          SUM(CASE WHEN ${sqlTagServico("sc.nome")} = 'CAMERA'   THEN 1 ELSE 0 END) AS qtd_camera,
          SUM(CASE WHEN ${sqlTagServico("sc.nome")} = 'STREAMER' THEN sc.valor ELSE 0 END) AS valor_streamer,
          SUM(CASE WHEN ${sqlTagServico("sc.nome")} = 'CAMERA'   THEN sc.valor ELSE 0 END) AS valor_camera,
          SUM(sc.valor) AS valor_total
        FROM sis_sercontratos sc
        INNER JOIN sis_cliente c ON UPPER(TRIM(c.login)) = UPPER(TRIM(sc.login))
        WHERE ${where.join(" AND ")}
        GROUP BY c.login, c.nome, c.email, c.cidade, c.cpf_cnpj, c.cli_ativado
        ORDER BY c.nome ASC
      `;

      const rows = (await MkauthSource.query(sql, params)) as any[];

      // Nome comercial completo de cada serviço, no lugar das tags cruas.
      const resumos = await buscarResumoCameras(rows.map((r) => r.login));
      const enriquecidas = rows.map((r) => {
        const qtdStreamer = Number(r.qtd_streamer || 0);
        const qtdCamera = Number(r.qtd_camera || 0);
        const valorStreamer = Number(r.valor_streamer || 0);
        const valorCamera = Number(r.valor_camera || 0);
        const resumo =
          resumos.get(String(r.login || "").trim().toUpperCase()) ?? null;
        return {
          ...r,
          nome_streamer:
            qtdStreamer > 0
              ? nomeStreaming(valorStreamer / qtdStreamer)
              : null,
          nome_camera:
            qtdCamera > 0 ? nomeServicoCamera(resumo, valorCamera) : null,
        };
      });

      res.json(enriquecidas);
    } catch (error: any) {
      console.error("Erro BuscarClientesServicos:", error?.message);
      res.status(500).json({ error: "Erro ao buscar clientes." });
    }
  };

  private async _emitirNfseServicoUnico(opts: {
    login: string;
    valor: number;
    servico: string;
    descricao: string;
    password: string;
    ambiente: string;
    aliquota: string;
    currentRpsNumber: number;
    nextNfseNumber: number;
    targetSeries: string;
  }): Promise<{ ok: boolean; error?: any; nfse?: any }> {
    const {
      login,
      valor,
      servico,
      descricao,
      password,
      ambiente,
      aliquota,
      currentRpsNumber,
      nextNfseNumber,
      targetSeries,
    } = opts;

    const ClientRepository = MkauthSource.getRepository(ClientesEntities);
    const ClientData = await ClientRepository.findOne({ where: { login } });
    if (!ClientData) {
      return { ok: false, error: `Cliente ${login} não encontrado` };
    }

    const ibgeId = await codigoIbgeDaCidade(ClientData?.cidade);

    const email =
      ClientData?.email && ClientData.email.trim() !== ""
        ? ClientData.email.trim()
        : "sememail@wiptelecom.com.br";

    const cnpjPrestador =
      ambiente === "producao"
        ? process.env.MUNICIPIO_LOGIN
        : process.env.MUNICIPIO_CNPJ_TEST;
    const inscricaoPrestador =
      ambiente === "producao"
        ? process.env.MUNICIPIO_INCRICAO
        : process.env.MUNICIPIO_INCRICAO_TEST;

    const aliquotaFmt = Number(aliquota || 0).toFixed(4);
    const serieToUse = ambiente === "homologacao" ? "wip99" : targetSeries;
    const emailToUse =
      ambiente === "homologacao"
        ? "suporte_wiptelecom@outlook.com"
        : email;
    const optanteSimples = ambiente === "homologacao" ? "2" : "1";

    const dps = this.nacionalXml.createDpsXml({
      ambiente,
      serie: serieToUse,
      numero: currentRpsNumber,
      codigoMunicipio: CODIGO_MUNICIPIO,
      prestador: {
        cnpj: cnpjPrestador || "",
        inscricaoMunicipal: inscricaoPrestador || "",
        optanteSimples,
      },
      tomador: {
        cpfCnpj: ClientData.cpf_cnpj || "",
        nome: this.removerAcentos(ClientData.nome || ""),
        logradouro: this.removerAcentos(ClientData.endereco || ""),
        numero: ClientData.numero || "",
        complemento: this.removerAcentos(ClientData.complemento || ""),
        bairro: this.removerAcentos(ClientData.bairro || ""),
        codigoMunicipio: ibgeId,
        cep: ClientData.cep?.replace(/[^0-9]/g, "") || "",
        telefone: ClientData.celular?.replace(/[^0-9]/g, "") || "",
        email: emailToUse,
      },
      servico: {
        itemListaServico: servico,
        discriminacao: this.removerAcentos(descricao || "Servicos Adicionais"),
      },
      valores: {
        valorServicos: Number(valor),
        aliquota: aliquotaFmt,
        issRetido: 2,
      },
    });

    let envio: Awaited<ReturnType<NFSEController["enviarDpsNacional"]>>;
    try {
      envio = await this.enviarDpsNacional(
        [dps],
        password,
        ambiente,
      );
    } catch (err: any) {
      console.error(
        "[NFSE-Servicos] SOAP fault para",
        login,
        ":",
        err?.message || err,
      );
      return { ok: false, error: err?.message || String(err) };
    }

    const resultado = envio.porDps.get(dps.id);
    const temSucesso = resultado?.nota;

    if (!temSucesso) {
      const erro = resultado?.erros.length
        ? resumoMensagens(resultado.erros)
        : envio.responseXml.slice(0, 2000);
      console.error("[NFSE-Servicos] Falha para", login, "— erro:", erro);
      return { ok: false, error: erro };
    }

    const NsfeData = AppDataSource.getRepository(NFSE);
    const novoRegistro = NsfeData.create({
      login,
      numeroRps: currentRpsNumber,
      serieRps: serieToUse,
      tipoRps: 1,
      dataEmissao: new Date(),
      competencia: new Date(),
      valorServico: Number(valor),
      aliquota: Number(aliquota) || 0,
      issRetido: 2,
      responsavelRetencao: 1,
      itemListaServico: servico,
      discriminacao: descricao || "Servicos Adicionais",
      codigoMunicipio: 0,
      exigibilidadeIss: 1,
      cnpjPrestador: cnpjPrestador || "",
      inscricaoMunicipalPrestador: inscricaoPrestador || "",
      cpfTomador: ClientData.cpf_cnpj.replace(/[^0-9]/g, "") || "",
      razaoSocialTomador: ClientData.nome || "",
      enderecoTomador: ClientData.endereco || "",
      numeroEndereco: ClientData.numero || "",
      complemento: ClientData.complemento || undefined,
      bairro: ClientData.bairro || "",
      uf: "SP",
      cep: ClientData.cep.replace(/[^0-9]/g, "") || "",
      telefoneTomador: ClientData.celular.replace(/[^0-9]/g, "") || undefined,
      emailTomador: email,
      optanteSimplesNacional: 1,
      incentivoFiscal: 2,
      ambiente,
      status: "Ativa",
      numeroNfe: Number(temSucesso.numero) || nextNfseNumber,
      modelo: "nacional",
      chaveNfse: temSucesso.chave || null,
      idDps: dps.id,
    });
    await NsfeData.save(novoRegistro);
    return {
      ok: true,
      nfse: { numero: temSucesso.numero, chave: temSucesso.chave },
    };
  }

  public EmitirNfseServicos = async (req: Request, res: Response) => {
    try {
      const {
        logins,
        password,
        ambiente = "homologacao",
        aliquota,
        servico,
        nfeNumber,
        ultimoRps,
      } = req.body as {
        logins?: string[];
        password?: string;
        ambiente?: string;
        aliquota?: string;
        servico?: string;
        nfeNumber?: string | number;
        ultimoRps?: string | number;
      };

      if (!Array.isArray(logins) || logins.length === 0) {
        res.status(400).json({ error: "Selecione ao menos um cliente." });
        return;
      }
      if (!password || !nfeNumber) {
        res
          .status(400)
          .json({ error: "password e nfeNumber são obrigatórios." });
        return;
      }

      // A NFSE exige o RPS: o usuário informa o último usado e as notas saem a
      // partir do seguinte, uma a uma.
      const primeiroRps = proximoNumeroRps(ultimoRps);
      if (primeiroRps === null) {
        res.status(400).json({ error: "Informe o último número de RPS usado." });
        return;
      }

      this.PASSWORD = password;
      this.configureProvider(ambiente);

      const NsfeData = AppDataSource.getRepository(NFSE);
      const lastProd = await NsfeData.findOne({
        where: { serieRps: Not("wip99") },
        order: { id: "DESC" },
      });
      const targetSeries = lastProd?.serieRps || "1";

      const startNumbers = await this.getLastNfseNumber(
        Number(nfeNumber),
        ambiente,
      );
      let nextNfseNumber = startNumbers.nextNfseNumber;
      let currentRpsNumber = primeiroRps;

      const results: any[] = [];
      for (const login of logins) {
        const rows = (await MkauthSource.query(
          `SELECT ${sqlTagServico("nome")} AS nome, valor FROM sis_sercontratos
           WHERE UPPER(TRIM(login)) = UPPER(TRIM(?))
             AND ${sqlTagServico("nome")} IN ('STREAMER', 'CAMERA')`,
          [login],
        )) as { nome: string; valor: any }[];

        if (!rows.length) {
          results.push({ login, ok: false, error: "Sem serviços adicionais." });
          continue;
        }

        const qtdStreamer = rows.filter((r) => r.nome === "STREAMER").length;
        const qtdCamera = rows.filter((r) => r.nome === "CAMERA").length;
        const valorStreamer = rows
          .filter((r) => r.nome === "STREAMER")
          .reduce((s, r) => s + Number(r.valor || 0), 0);
        const valorCamera = rows
          .filter((r) => r.nome === "CAMERA")
          .reduce((s, r) => s + Number(r.valor || 0), 0);
        const valorTotal = valorStreamer + valorCamera;

        // Câmeras: o nome do serviço traz os canais gravando na nuvem e a cota
        // de armazenamento compartilhada, lidos do banco das câmeras.
        const resumoCamera =
          qtdCamera > 0 ? await buscarResumoCameraDeUmLogin(login) : null;

        const partes: string[] = [];
        if (qtdStreamer > 0)
          partes.push(
            `${nomeStreaming(valorStreamer / qtdStreamer)} (${qtdStreamer}x): R$ ${formatBRL(valorStreamer)}`,
          );
        if (qtdCamera > 0)
          partes.push(
            `${nomeServicoCamera(resumoCamera, valorCamera)}: R$ ${formatBRL(valorCamera)}`,
          );
        const descricao = `Servicos adicionais - ${partes.join(" / ")} - Total: R$ ${formatBRL(valorTotal)}`;

        const r = await this._emitirNfseServicoUnico({
          login,
          valor: valorTotal,
          servico: servico || "Servicos Adicionais",
          descricao,
          password,
          ambiente,
          aliquota: aliquota || "",
          currentRpsNumber,
          nextNfseNumber,
          targetSeries,
        });
        results.push({
          login,
          ok: r.ok,
          error: r.error,
          numeroRps: currentRpsNumber,
          numeroNfe: Number(r.nfse?.numero) || nextNfseNumber,
          valor: valorTotal,
        });

        if (r.ok) {
          currentRpsNumber += 1;
          nextNfseNumber += 1;
        }
      }

      const okCount = results.filter((r) => r.ok).length;
      res.json({
        message: `${okCount}/${results.length} NFSE(s) emitida(s).`,
        results,
      });
    } catch (error: any) {
      console.error("Erro EmitirNfseServicos:", error?.message);
      res.status(500).json({ error: "Erro interno", detalhes: error?.message });
    }
  };
}

export default new NFSEController();
