import AppDataSource from "../database/MkauthSource";
import { Faturas } from "../entities/Faturas";
import { ClientesEntities } from "../entities/ClientesEntities";
import EfiPay from "sdk-node-apis-efi";
import dotenv from "dotenv";
import crypto from "crypto";
import path from "path";
import fs from "fs";
import axios from "axios";
import { Request, Response } from "express";
import { Between, In, IsNull, Not, Repository } from "typeorm";
import { isNotIn } from "class-validator";
import Whatsapp from "./Whatsapp";
import LocalDataSource from "../database/DataSource";
import { SolicitacaoServico } from "../entities/SolicitacaoServico";
import { whatsappOutgoingQueue } from "./whatsapp/index";
import ZapSign from "./ZapSign";
import { liberarContratoPosPagamento } from "./servicoWeb/contrato";
import pixAutomaticoService from "../services/PixAutomaticoService";
import licencaMensalidadeService, {
  INFO_LICENCA,
} from "../services/LicencaMensalidadeService";

dotenv.config();

const logFilePath = path.join(__dirname, "..", "..", "/log", "logPix.json");
const isSandbox = process.env.SERVIDOR_HOMOLOGACAO === "true";

const waToken = isSandbox
  ? process.env.CLOUD_API_ACCESS_TOKEN_TEST
  : process.env.CLOUD_API_ACCESS_TOKEN;

const waUrl = isSandbox
  ? `https://graph.facebook.com/v22.0/${process.env.WA_PHONE_NUMBER_ID_TEST}/messages`
  : `https://graph.facebook.com/v22.0/${process.env.WA_PHONE_NUMBER_ID}/messages`;

const options = {
  sandbox: isSandbox,
  client_id: isSandbox
    ? process.env.CLIENT_ID_HOMOLOGACAO!
    : process.env.CLIENT_ID!,
  client_secret: isSandbox
    ? process.env.CLIENT_SECRET_HOMOLOGACAO!
    : process.env.CLIENT_SECRET!,
  certificate: isSandbox
    ? path.resolve("src", "files", process.env.CERTIFICATE_SANDBOX!)
    : path.resolve("dist", "files", process.env.CERTIFICATE_PROD!),
  validateMtls: false,
};

const chave_pix = process.env.CHAVE_PIX as string;

const urlPix = isSandbox
  ? "https://pix-h.api.efipay.com.br"
  : "https://pix.api.efipay.com.br";

class Pix {
  private recordRepo = AppDataSource.getRepository(Faturas);
  private clienteRepo = AppDataSource.getRepository(ClientesEntities);

  AlterarWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const { urlWebhook } = req.body;
      console.log(urlWebhook);

      options.validateMtls = false;
      const efipay = new EfiPay(options);
      const response = await efipay.pixConfigWebhook(
        { chave: chave_pix },
        { webhookUrl: String(urlWebhook) },
      );
      res.status(200).json(response);
    } catch (error) {
      res.status(500).json(error);
    }
  };

  AlterarWebhookPixAutomatico = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const { urlWebhook } = req.body;
      console.log(urlWebhook);

      options.validateMtls = false;
      const efipay = new EfiPay(options);
      const response = await efipay.pixConfigWebhookAutomaticCharge(
        {},
        { webhookUrl: String(urlWebhook) },
      );
      res.status(200).json(response);
    } catch (error) {
      res.status(500).json(error);
    }
  };

  aplicarJuros_Desconto = async (
    valor: string | number,
    pppoe: string,
    dataVenc: Date | string,
  ): Promise<number> => {
    try {
      // 🔹 Busca o cliente no banco de dados pelo login (pppoe)
      const client = await this.clienteRepo.findOne({
        where: { login: pppoe },
      });

      // 🔹 Pega o desconto do cliente (ou 0 se não tiver)
      const desconto = client?.desconto || 0;

      // 🔹 Converte o valor recebido em número e aplica o desconto
      let valorFinal = Number(valor) - desconto;

      // 🔹 Garante que o valor nunca fique negativo
      if (valorFinal < 0) valorFinal = 0;

      // 🔹 Cria datas sem horário (somente dia/mês/ano)
      const resetTime = (date: Date) => {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
      };

      const dataHoje = resetTime(new Date());
      const dataVencimento = resetTime(new Date(dataVenc));

      console.log("📅 Data de hoje:", dataHoje.toLocaleDateString());
      console.log(
        "📆 Data de vencimento:",
        dataVencimento.toLocaleDateString(),
      );

      // 🔹 Se ainda não venceu
      if (dataVencimento > dataHoje) {
        console.log("✅ Não está em atraso");
        return Number(valorFinal.toFixed(2));
      }

      // 🔹 Se vence exatamente hoje
      if (dataVencimento.getTime() === dataHoje.getTime()) {
        console.log("📅 Vence hoje (sem juros ou multa)");
        return Number(valorFinal.toFixed(2));
      }

      // 🔹 Se está em atraso
      console.log("⚠️ Está em atraso!");

      // Função auxiliar para calcular a diferença em dias entre duas datas
      const differenceInDays = (d1: Date, d2: Date): number => {
        const oneDay = 24 * 60 * 60 * 1000;
        return Math.floor(Math.abs((d2.getTime() - d1.getTime()) / oneDay));
      };

      const diffInDays = differenceInDays(dataVencimento, dataHoje);
      console.log("📆 Dias de atraso:", diffInDays);

      // 🔹 Definições de multa e juros
      const monthlyFine = 0.02; // 2% fixo
      const dailyFine = 0.00033; // 0.033% ao dia

      // 🔹 Multa de 2% sobre o valor original
      const multaMensal = valorFinal * monthlyFine;

      // 🔹 Juros diários (só após 4 dias de tolerância)
      const multaDiaria =
        diffInDays > 4 ? valorFinal * ((diffInDays - 4) * dailyFine) : 0;

      // 🔹 Soma total das multas ao valor
      valorFinal = valorFinal + multaMensal + multaDiaria;

      console.log("💰 Valor base:", valor);
      console.log("📈 Multa mensal:", multaMensal.toFixed(2));
      console.log("📈 Multa diária:", multaDiaria.toFixed(2));
      console.log("✅ Valor final com juros:", valorFinal.toFixed(2));

      // 🔹 Retorna o valor arredondado com duas casas decimais
      return Number(valorFinal.toFixed(2));
    } catch (error) {
      console.error("❌ Erro em aplicarJuros_Desconto:", error);
      // 🔹 Em caso de erro, retorna o valor original sem alteração
      return Number(valor);
    }
  };

  aplicar_Desconto = async (
    valor: string | number,
    pppoe: string,
  ): Promise<number> => {
    try {
      // 🔹 Busca o cliente no banco de dados pelo login (pppoe)
      const client = await this.clienteRepo.findOne({
        where: { login: pppoe },
      });

      // 🔹 Pega o desconto do cliente (ou 0 se não tiver)
      const desconto = client?.desconto || 0;

      // 🔹 Converte o valor recebido em número e aplica o desconto
      let valorFinal = Number(valor) - desconto;

      // 🔹 Garante que o valor nunca fique negativo
      if (valorFinal < 0) valorFinal = 0;

      return Number(valorFinal.toFixed(2));
    } catch (error) {
      console.error("❌ Erro em aplicarJuros_Desconto:", error);
      // 🔹 Em caso de erro, retorna o valor original sem alteração
      return Number(valor);
    }
  };

  /**
   * Conferência manual: lê as cobranças do período na Efí e dá baixa nas
   * mensalidades já pagas. É a mesma rotina que roda todo dia às 4h.
   */
  conciliarPixAutomatico = async (req: Request, res: Response) => {
    try {
      const { inicio, fim } = req.body ?? {};
      const resumo = await pixAutomaticoService.conciliarPeriodo(
        inicio ? new Date(inicio) : undefined,
        fim ? new Date(fim) : undefined,
      );
      res.status(200).json(resumo);
    } catch (error: any) {
      console.log(error);
      res.status(500).json({ error: error?.message || error });
    }
  };

  /**
   * Gera as cobranças do mês que estiverem faltando. Serve para recuperar o
   * mês quando o servidor estava fora do ar no dia 1º.
   */
  gerarCobrancasDoMes = async (req: Request, res: Response) => {
    try {
      const { referencia } = req.body ?? {};
      const resumo = await pixAutomaticoService.garantirCobrancasDoMes(
        referencia ? new Date(referencia) : undefined,
      );
      res.status(200).json(resumo);
    } catch (error: any) {
      console.log(error);
      res.status(500).json({ error: error?.message || error });
    }
  };

  /**
   * Mostra os webhooks do Pix Automático que estão cadastrados hoje na Efí.
   *
   * Serve para conferir o endereço que a Efí vai chamar: ela acrescenta "/rec"
   * e "/cobr" ao final da URL cadastrada, a não ser que o endereço termine em
   * "?ignorar=".
   */
  consultarWebhooksPixAutomatico = async (
    _req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      options.validateMtls = false;
      const efipay = new EfiPay(options);

      const [recorrencia, cobranca] = await Promise.allSettled([
        efipay.pixListWebhookRecurrenceAutomatic(),
        efipay.pixListWebhookAutomaticCharge(),
      ]);

      res.status(200).json({
        recorrencia:
          recorrencia.status === "fulfilled" ? recorrencia.value : null,
        erroRecorrencia:
          recorrencia.status === "rejected" ? recorrencia.reason : null,
        cobranca: cobranca.status === "fulfilled" ? cobranca.value : null,
        erroCobranca: cobranca.status === "rejected" ? cobranca.reason : null,
      });
    } catch (error) {
      console.log(error);
      res.status(500).json(error);
    }
  };

  AlterarWebhookPixAutomaticoRecorrencia = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const { urlWebhookRecurrency } = req.body;
      console.log(urlWebhookRecurrency);

      options.validateMtls = false;
      const efipay = new EfiPay(options);
      const response = await efipay.pixConfigWebhookRecurrenceAutomatic(
        {},
        { webhookUrl: String(urlWebhookRecurrency) },
      );
      res.status(200).json(response);
    } catch (error) {
      res.status(500).json(error);
    }
  };

  getAccessToken = async (): Promise<string | null> => {
    const url = "https://cobrancas.api.efipay.com.br/v1/authorize";
    const clientId = process.env.CLIENT_ID_SEM_SDK!;
    const clientSecret = process.env.CLIENT_SECRET_SEM_SDK!;
    const data = { grant_type: "client_credentials" };
    try {
      const response = await axios.post(url, data, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(
            `${clientId}:${clientSecret}`,
          ).toString("base64")}`,
        },
      });
      return response.data.access_token;
    } catch (error: any) {
      console.error(
        "Erro ao obter token:",
        error.response?.data || error.message,
      );
      return null;
    }
  };

  setPaid = async (token: string, chargeId: string): Promise<any> => {
    const url = `https://cobrancas.api.efipay.com.br/v1/charge/${chargeId}/settle`;
    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    try {
      const response = await axios.put(url, {}, { headers });
      return response.data;
    } catch (error: any) {
      return {
        erro: `Falha ao atualizar ${chargeId}: ${
          error.response ? error.response.data : error.message
        }`,
      };
    }
  };

  StatusUpdatePixTodosVencidos = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const pixData = req.body.pix;

      console.log("********** WEBHOOK PIX **********");
      console.log(JSON.stringify(pixData, null, 2));
      console.log("*********************************");

      if (!pixData || pixData.length === 0) {
        res.status(200).json("Nenhum dado de PIX recebido");
        return;
      }

      const { txid } = pixData[0];
      const efipay = new EfiPay(options);
      let pix: any;

      try {
        pix = await efipay.pixDetailCharge({ txid });
      } catch {
        try {
          pix = await efipay.pixDetailDueCharge({ txid });
        } catch {
          res.status(404).json("Cobrança PIX não encontrada");
          return;
        }
      }

      if (!pix) {
        res.status(404).json("Detalhes do PIX não encontrados");
        return;
      }

      const status = pix.status;
      console.log(`[Webhook PIX] status=${status} | txid=${txid}`);
      console.log(
        `[Webhook PIX] infoAdicionais=${JSON.stringify(pix.infoAdicionais)}`,
      );

      if (status !== "CONCLUIDA") {
        res.status(200).json({ message: "PIX ainda não concluído", status });
        return;
      }

      // Mensalidade de licença de software: baixa no sistema de licenças e
      // termina aqui. Não pode seguir para o MKAuth — mensalidade de internet
      // é outro assunto, e a cobrança de licença nem leva o par ID/VALOR que
      // o trecho abaixo usa.
      const marcaLicenca = Array.isArray(pix.infoAdicionais)
        ? pix.infoAdicionais.find((info: any) => info?.nome === INFO_LICENCA)
        : null;

      if (marcaLicenca?.valor) {
        const mensalidade = await licencaMensalidadeService.baixarPorPix({
          mensalidadeId: Number(marcaLicenca.valor),
          txid,
          valorPago: pixData[0]?.valor ?? pix?.valor?.original,
          endToEndId: pixData[0]?.endToEndId,
          horario: pixData[0]?.horario
            ? new Date(pixData[0].horario)
            : new Date(),
        });

        res.status(200).json({
          message: mensalidade
            ? "Mensalidade de licença baixada"
            : "Mensalidade de licença não encontrada",
        });
        return;
      }

      const data = new Date();
      const updates: { idValor: string; valor: string }[] = [];
      let qrCodeLink = "";

      if (Array.isArray(pix.infoAdicionais)) {
        pix.infoAdicionais.forEach((info: any, index: number) => {
          if (info.nome === "QR" && info.valor) qrCodeLink = info.valor;
          if (
            info.nome === "ID" &&
            pix.infoAdicionais[index + 1]?.nome === "VALOR"
          ) {
            updates.push({
              idValor: info.valor,
              valor: pix.infoAdicionais[index + 1].valor,
            });
          }
        });
      }

      // As cobranças da jornada 3 criadas antes da padronização levam só
      // "TITULO" com o número da fatura. Sem isto, o pagamento entra e a
      // mensalidade fica em aberto, sem erro nenhum aparecer.
      if (updates.length === 0 && Array.isArray(pix.infoAdicionais)) {
        const titulo = pix.infoAdicionais.find(
          (info: any) => info?.nome === "TITULO" && info?.valor,
        );
        if (titulo) {
          updates.push({
            idValor: String(titulo.valor),
            valor: String(pixData[0]?.valor ?? pix?.valor?.original ?? ""),
          });
          console.log(
            `[Webhook PIX] fatura identificada por TITULO=${titulo.valor}`,
          );
        }
      }

      console.log(`[Webhook PIX] updates gerados: ${JSON.stringify(updates)}`);

      for (const update of updates) {
        await this.recordRepo.update(update.idValor, {
          status: "pago",
          valorpag: update.valor,
          datapag: data,
          coletor: "api_mk_pedro",
          formapag: "pix_pedro_api",
        });

        const record_pppoe = await this.recordRepo.findOne({
          where: { id: Number(update.idValor) },
        });
        if (!record_pppoe) continue;

        // --- Processamento de serviços (independente de o cliente existir no MKAuth) ---
        console.log(
          `[Webhook PIX] tipo=${record_pppoe.tipo} | login=${record_pppoe.login} | id=${record_pppoe.id}`,
        );
        if (record_pppoe.tipo === "servicos") {
          try {
            const localRepo = LocalDataSource.getRepository(SolicitacaoServico);
            const servicoNome = record_pppoe.obs
              .split("Serviço: ")[1]
              ?.split(" -")[0];
            console.log(`[Webhook PIX] servicoNome extraído: "${servicoNome}"`);

            // Busca prioritariamente pelo ID da fatura vinculada
            let solicitacao = await localRepo.findOne({
              where: { id_fatura: Number(record_pppoe.id), pago: false },
              order: { data_solicitacao: "DESC" },
            });
            console.log(
              `[Webhook PIX] solicitacao por id_fatura=${record_pppoe.id}: ${solicitacao ? `id=${solicitacao.id}` : "não encontrada"}`,
            );

            // Fallback pelo login + serviço
            if (!solicitacao && servicoNome) {
              solicitacao = await localRepo.findOne({
                where: {
                  login_cliente: record_pppoe.login,
                  servico: servicoNome,
                  pago: false,
                },
                order: { data_solicitacao: "DESC" },
              });
              console.log(
                `[Webhook PIX] solicitacao por login+serviço: ${solicitacao ? `id=${solicitacao.id}` : "não encontrada"}`,
              );
            }

            if (solicitacao) {
              solicitacao.pago = true;
              await localRepo.save(solicitacao);
              console.log(
                `[Dashboard Sync] Solicitação ${solicitacao.id} marcada como paga (Fatura ID: ${record_pppoe.id})`,
              );
            }

            // Notificação para TEST_PHONE
            const testPhone = process.env.TEST_PHONE;
            if (testPhone) {
              try {
                await whatsappOutgoingQueue.add(
                  "send-template",
                  {
                    url: waUrl,
                    payload: {
                      messaging_product: "whatsapp",
                      recipient_type: "individual",
                      to: testPhone,
                      type: "template",
                      template: {
                        name: "notificacao_pagamento",
                        language: { code: "pt_BR" },
                      },
                    },
                    headers: {
                      Authorization: `Bearer ${waToken}`,
                      "Content-Type": "application/json",
                    },
                  },
                  {
                    removeOnComplete: true,
                    removeOnFail: false,
                    attempts: 3,
                    backoff: { type: "exponential", delay: 5000 },
                  },
                );
              } catch (queueError) {
                console.error(
                  "[Webhook PIX] Erro ao enfileirar notificação:",
                  queueError,
                );
              }
            }

            // Determina o telefone do cliente a partir da solicitação (funciona mesmo sem MKAuth)
            let requesterPhone = "";
            if (solicitacao?.dados?.telefone_conversa) {
              const clean = solicitacao.dados.telefone_conversa.replace(
                /\D/g,
                "",
              );
              requesterPhone = clean.startsWith("55") ? clean : "55" + clean;
            } else if (solicitacao?.dados?.telefone) {
              const clean = solicitacao.dados.telefone.replace(/\D/g, "");
              requesterPhone = clean.startsWith("55") ? clean : "55" + clean;
            }

            // Fallback para telefone do MKAuth se disponível
            if (!requesterPhone) {
              const sis_clienteFallback = await this.clienteRepo.findOne({
                where: { login: record_pppoe.login },
              });
              const tel =
                sis_clienteFallback?.celular || sis_clienteFallback?.fone || "";
              if (tel) {
                const clean = tel.replace(/\D/g, "");
                requesterPhone = clean.startsWith("55") ? clean : "55" + clean;
              }
            }

            // Cria ZapSign se houver solicitação com dados
            let zapSignUrl = "";
            // Solicitações que já têm contrato (webhook repetido) não geram um
            // segundo documento.
            if (solicitacao?.dados && !solicitacao.token_zapsign) {
              try {
                // Origem web: o serviço e o valor combinado estão no link, e a
                // página pública precisa ver o contrato no resultado.
                const urlWeb = await liberarContratoPosPagamento(solicitacao);
                if (urlWeb) zapSignUrl = urlWeb;
              } catch (errWeb) {
                console.error(
                  "[Webhook PIX] Erro ao liberar contrato do link web:",
                  errWeb,
                );
              }
            }
            if (solicitacao?.dados && !solicitacao.token_zapsign) {
              try {
                let zapResponse;
                if (
                  solicitacao.servico === "Instalação" &&
                  solicitacao.dados.dificuldade_acesso
                ) {
                  zapResponse =
                    await ZapSign.createContractInstalacaoDificuldadeAcesso(
                      solicitacao.dados,
                    );
                } else if (solicitacao.servico === "Instalação") {
                  zapResponse = await ZapSign.createContractInstalacao(
                    solicitacao.dados,
                  );
                } else if (solicitacao.servico === "Mudança de Endereço") {
                  zapResponse = await ZapSign.createContractMudancaEndereco(
                    solicitacao.dados,
                  );
                }
                if (zapResponse) {
                  zapSignUrl = zapResponse.signers[0].sign_url;
                  solicitacao.token_zapsign = zapResponse.token;
                  solicitacao.assinado = false;
                  await localRepo.save(solicitacao);
                  console.log(`[Webhook PIX] ZapSign gerado: ${zapSignUrl}`);
                }
              } catch (errZap) {
                console.error("[Webhook PIX] Erro ao gerar ZapSign:", errZap);
              }
            }

            // Envia WhatsApp ao cliente
            if (requesterPhone) {
              const nomeCliente =
                solicitacao?.dados?.nome || record_pppoe.login;
              const nomeServico = servicoNome || "Contratado";
              if (zapSignUrl) {
                await Whatsapp.MensagensComuns(
                  requesterPhone,
                  `✅ *Pagamento Confirmado!*\n\nOlá ${nomeCliente}, recebemos o pagamento do serviço: *${nomeServico}*.\n\n📄 *Link de Assinatura:* ${zapSignUrl}\n\nPor favor, *Assine* para formalizarmos o serviço! 🚀`,
                );
              } else {
                await Whatsapp.MensagensComuns(
                  requesterPhone,
                  `✅ *Pagamento Confirmado!*\n\nOlá ${nomeCliente}, recebemos o pagamento do serviço: *${nomeServico}*.\n\nNossa equipe entrará em contato em breve para dar prosseguimento. Obrigado pela confiança! 🚀`,
                );
              }
            }
          } catch (waError) {
            console.error("[Webhook PIX] Erro ao processar serviço:", waError);
          }
        }

        // --- Processamento de mensalidade (requer cliente no MKAuth) ---
        const sis_cliente = await this.clienteRepo.findOne({
          where: { login: record_pppoe.login },
        });

        if (sis_cliente && record_pppoe.tipo !== "servicos") {
          const remObsDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
            .toISOString()
            .replace("T", " ")
            .replace("Z", "");
          await this.clienteRepo.update(
            { login: sis_cliente.login },
            { observacao: "sim", rem_obs: remObsDate },
          );
        }

        try {
          const dataLog = fs.existsSync(logFilePath)
            ? fs.readFileSync(logFilePath, "utf8")
            : "[]";
          const logs = Array.isArray(JSON.parse(dataLog))
            ? JSON.parse(dataLog)
            : [];
          logs.push({
            tipo: "PAGAMENTO CONCLUIDO",
            pppoe: record_pppoe?.login,
            status_do_pagamento: status,
            id: update.idValor,
            valor: update.valor,
            qr: qrCodeLink,
            timestamp: new Date().toISOString(),
          });
          fs.writeFileSync(logFilePath, JSON.stringify(logs, null, 2), "utf8");
        } catch {}

        const cliente = await this.recordRepo.findOne({
          where: { id: Number(update.idValor), chave_gnet2: Not(IsNull()) },
        });
        if (cliente) {
          const token = await this.getAccessToken();
          if (token) {
            await this.setPaid(token, cliente.chave_gnet2!);
          }
        }
      }
      res.status(200).json({ message: "Status atualizado com sucesso" });
      return;
    } catch (error: any) {
      console.error("Erro em StatusUpdatePixTodosVencidos:", error);
      res.status(500).json(error);
      return;
    }
  };

  /**
   * Webhook das cobranças do Pix Automático.
   *
   * Grava a notificação e responde 200 na mesma hora: a Efí só tenta entregar
   * 9 vezes (cerca de 5 horas) e o reenvio manual dela não vale para o Pix
   * Automático, então uma falha de processamento não pode derrubar a entrega.
   * O processamento vem depois, e é ele que confere na Efí se o dinheiro
   * entrou antes de baixar a mensalidade.
   */
  PixAutomaticWebhookCobr = async (req: Request, res: Response) => {
    let notificacao = null;
    try {
      notificacao = await pixAutomaticoService.registrarNotificacao(
        "cobr",
        req.body,
      );
    } catch (error) {
      console.error("❌ Falha ao gravar notificação do Pix Automático:", error);
    }

    res.status(200).json({ recebido: true });

    if (notificacao) {
      pixAutomaticoService
        .processarNotificacao(notificacao)
        .catch((error) =>
          console.error("❌ Falha ao processar notificação cobr:", error),
        );
    }
  };

  /**
   * Webhook das recorrências: avisa quando o cliente autoriza ou cancela a
   * recorrência. Fica registrado para consulta; quem dá baixa em mensalidade é
   * o webhook das cobranças.
   */
  PixAutomaticWebhookRec = async (req: Request, res: Response) => {
    let notificacao = null;
    try {
      notificacao = await pixAutomaticoService.registrarNotificacao(
        "rec",
        req.body,
      );
    } catch (error) {
      console.error("❌ Falha ao gravar notificação do Pix Automático:", error);
    }

    res.status(200).json({ recebido: true });

    if (notificacao) {
      pixAutomaticoService
        .processarNotificacao(notificacao)
        .catch((error) =>
          console.error("❌ Falha ao processar notificação rec:", error),
        );
    }
  };
  validarCPF(cpfCnpj: string): boolean {
    cpfCnpj = cpfCnpj.replace(/[^\d]+/g, "");
    if (cpfCnpj.length === 11) {
      if (/^(\d)\1+$/.test(cpfCnpj)) return false;
      let soma = 0,
        resto;
      for (let i = 1; i <= 9; i++)
        soma += parseInt(cpfCnpj.substring(i - 1, i)) * (11 - i);
      resto = (soma * 10) % 11;
      if (resto === 10 || resto === 11) resto = 0;
      if (resto !== parseInt(cpfCnpj.substring(9, 10))) return false;
      soma = 0;
      for (let i = 1; i <= 10; i++)
        soma += parseInt(cpfCnpj.substring(i - 1, i)) * (12 - i);
      resto = (soma * 10) % 11;
      if (resto === 10 || resto === 11) resto = 0;
      return resto === parseInt(cpfCnpj.substring(10, 11));
    } else if (cpfCnpj.length === 14) {
      if (/^(\d)\1+$/.test(cpfCnpj)) return false;
      let tamanho = cpfCnpj.length - 2;
      let numeros = cpfCnpj.substring(0, tamanho);
      let digitos = cpfCnpj.substring(tamanho);
      let soma = 0,
        pos = tamanho - 7;
      for (let i = tamanho; i >= 1; i--) {
        soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
        if (pos < 2) pos = 9;
      }
      let resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
      if (resultado !== parseInt(digitos.charAt(0))) return false;
      tamanho += 1;
      numeros = cpfCnpj.substring(0, tamanho);
      soma = 0;
      pos = tamanho - 7;
      for (let i = tamanho; i >= 1; i--) {
        soma += parseInt(numeros.charAt(tamanho - i)) * pos--;
        if (pos < 2) pos = 9;
      }
      resultado = soma % 11 < 2 ? 0 : 11 - (soma % 11);
      return resultado === parseInt(digitos.charAt(1));
    }
    return false;
  }

  gerarPix = async (req: Request, res: Response): Promise<void> => {
    try {
      let { pppoe, cpf, perdoarjuros } = req.body as {
        pppoe: string;
        cpf: string;
        perdoarjuros: boolean;
      };
      cpf = cpf.replace(/\D/g, "");

      const cliente = await this.recordRepo.findOne({
        where: { login: pppoe, status: "vencido", datadel: IsNull() },
        order: { datavenc: "ASC" as const },
      });

      if (!cliente) {
        res
          .status(500)
          .json("Usuário não encontrado ou sem mensalidades vencidas");
        return;
      }

      const efipay = new EfiPay(options);
      const loc = await efipay.pixCreateLocation([], { tipoCob: "cob" });
      const qrlink = await efipay.pixGenerateQRCode({ id: loc.id });
      const dataVenc = cliente.datavenc;

      const valor = Number(cliente.valor).toFixed(2);
      const params = { txid: crypto.randomBytes(16).toString("hex") };

      let valorDesconto = await this.aplicarJuros_Desconto(
        valor,
        pppoe,
        dataVenc,
      );

      const valorFinal = Number(valorDesconto).toFixed(2);

      if (perdoarjuros) {
        let valorPerdoado: string | number = await this.aplicar_Desconto(
          cliente.valor,
          pppoe,
        );
        valorPerdoado = valorPerdoado.toFixed(2);

        const body =
          cpf.length === 11
            ? {
                calendario: { expiracao: 43200 },
                devedor: { cpf, nome: pppoe },
                valor: { original: valorPerdoado },
                chave: chave_pix,
                solicitacaoPagador: "Mensalidade",
                infoAdicionais: [
                  { nome: "ID", valor: String(cliente.id) },
                  { nome: "VALOR", valor: valorPerdoado },
                  { nome: "QR", valor: String(qrlink.linkVisualizacao) },
                ],
                loc: { id: loc.id },
              }
            : {
                calendario: { expiracao: 43200 },
                devedor: { cnpj: cpf, nome: pppoe },
                valor: { original: valorPerdoado },
                chave: chave_pix,
                solicitacaoPagador: "Mensalidade",
                infoAdicionais: [
                  { nome: "ID", valor: String(cliente.id) },
                  { nome: "VALOR", valor: valorPerdoado },
                  { nome: "QR", valor: String(qrlink.linkVisualizacao) },
                ],
                loc: { id: loc.id },
              };

        await efipay.pixCreateCharge(params, body);

        const options2 = {
          month: "2-digit",
          day: "2-digit",
        } as Intl.DateTimeFormatOptions;
        const formattedDate = new Intl.DateTimeFormat("pt-BR", options2).format(
          cliente.datavenc as Date,
        );
        console.log("Juros Perdoado");
        res.status(200).json({
          valor: valorPerdoado,
          pppoe,
          link: qrlink.linkVisualizacao,
          formattedDate,
        });
        return;
      } else {
        const body =
          cpf.length === 11
            ? {
                calendario: { expiracao: 43200 },
                devedor: { cpf, nome: pppoe },
                valor: { original: valorFinal },
                chave: chave_pix,
                solicitacaoPagador: "Mensalidade",
                infoAdicionais: [
                  { nome: "ID", valor: String(cliente.id) },
                  { nome: "VALOR", valor: valorFinal },
                  { nome: "QR", valor: String(qrlink.linkVisualizacao) },
                ],
                loc: { id: loc.id },
              }
            : {
                calendario: { expiracao: 43200 },
                devedor: { cnpj: cpf, nome: pppoe },
                valor: { original: valorFinal },
                chave: chave_pix,
                solicitacaoPagador: "Mensalidade",
                infoAdicionais: [
                  { nome: "ID", valor: String(cliente.id) },
                  { nome: "VALOR", valor: valorFinal },
                  { nome: "QR", valor: String(qrlink.linkVisualizacao) },
                ],
                loc: { id: loc.id },
              };

        await efipay.pixCreateCharge(params, body);

        const options2 = {
          month: "2-digit",
          day: "2-digit",
        } as Intl.DateTimeFormatOptions;
        const formattedDate = new Intl.DateTimeFormat("pt-BR", options2).format(
          cliente.datavenc as Date,
        );

        res.status(200).json({
          valor: valorFinal,
          pppoe,
          link: qrlink.linkVisualizacao,
          formattedDate,
        });
        return;
      }
    } catch (error: any) {
      console.error("Erro em gerarPix:", error);
      res.status(500).json(error);
      return;
    }
  };

  gerarPixAberto = async (req: Request, res: Response): Promise<void> => {
    try {
      let { pppoe, cpf, perdoarjuros } = req.body as {
        pppoe: string;
        cpf: string;
        perdoarjuros: boolean;
      };
      cpf = cpf.replace(/\D/g, "");

      const cliente = await this.recordRepo.findOne({
        where: { login: pppoe, status: "aberto", datadel: IsNull() },
        order: { datavenc: "ASC" as const },
      });

      if (!cliente) {
        res
          .status(500)
          .json(
            "Usuário não encontrado, desativado ou sem mensalidades abertas",
          );
        return;
      }

      const efipay = new EfiPay(options);
      const loc = await efipay.pixCreateLocation([], { tipoCob: "cob" });
      const qrlink = await efipay.pixGenerateQRCode({ id: loc.id });

      const valor = Number(cliente.valor).toFixed(2);
      const params = { txid: crypto.randomBytes(16).toString("hex") };

      const dataVenc = cliente.datavenc;

      let valorDesconto = await this.aplicarJuros_Desconto(
        valor,
        pppoe,
        dataVenc,
      );

      const valorFinal = Number(valorDesconto).toFixed(2);

      if (perdoarjuros) {
        const valorsemJuros = await this.aplicar_Desconto(valor, pppoe);

        const body =
          cpf.length === 11
            ? {
                calendario: { expiracao: 43200 },
                devedor: { cpf, nome: pppoe },
                valor: { original: valorsemJuros.toFixed(2) },
                chave: chave_pix,
                solicitacaoPagador: "Mensalidade",
                infoAdicionais: [
                  { nome: "ID", valor: String(cliente.id) },
                  { nome: "VALOR", valor: valorsemJuros.toFixed(2) },
                  { nome: "QR", valor: String(qrlink.linkVisualizacao) },
                ],
                loc: { id: loc.id },
              }
            : {
                calendario: { expiracao: 43200 },
                devedor: { cnpj: cpf, nome: pppoe },
                valor: { original: valorsemJuros.toFixed(2) },
                chave: chave_pix,
                solicitacaoPagador: "Mensalidade",
                infoAdicionais: [
                  { nome: "ID", valor: String(cliente.id) },
                  { nome: "VALOR", valor: valorsemJuros.toFixed(2) },
                  { nome: "QR", valor: String(qrlink.linkVisualizacao) },
                ],
                loc: { id: loc.id },
              };

        await efipay.pixCreateCharge(params, body); //efipay

        res.status(200).json({
          valor: valorsemJuros,
          pppoe,
          link: qrlink.linkVisualizacao,
          dataVenc: cliente.datavenc,
        });
        return;
      } else {
        const body =
          cpf.length === 11
            ? {
                calendario: { expiracao: 43200 },
                devedor: { cpf, nome: pppoe },
                valor: { original: valorFinal },
                chave: chave_pix,
                solicitacaoPagador: "Mensalidade",
                infoAdicionais: [
                  { nome: "ID", valor: String(cliente.id) },
                  { nome: "VALOR", valor: valorFinal },
                  { nome: "QR", valor: String(qrlink.linkVisualizacao) },
                ],
                loc: { id: loc.id },
              }
            : {
                calendario: { expiracao: 43200 },
                devedor: { cnpj: cpf, nome: pppoe },
                valor: { original: valorFinal },
                chave: chave_pix,
                solicitacaoPagador: "Mensalidade",
                infoAdicionais: [
                  { nome: "ID", valor: String(cliente.id) },
                  { nome: "VALOR", valor: valorFinal },
                  { nome: "QR", valor: String(qrlink.linkVisualizacao) },
                ],
                loc: { id: loc.id },
              };

        await efipay.pixCreateCharge(params, body);

        res.status(200).json({
          valor: valorFinal,
          pppoe,
          link: qrlink.linkVisualizacao,
          dataVenc: cliente.datavenc,
        });
        return;
      }
    } catch (error: any) {
      console.error("Erro em gerarPixAberto:", error);
      res.status(500).json(error);
      return;
    }
  };

  /**
   * Gera um PIX para um lançamento de serviço específico
   */
  gerarPixServico = async (params: {
    idLancamento: number;
    valor: string;
    pppoe: string;
    cpf: string;
  }) => {
    try {
      const { idLancamento, valor, pppoe, cpf } = params;
      const cleanCpf = cpf.replace(/\D/g, "");

      const efipay = new EfiPay(options);
      const loc = await efipay.pixCreateLocation([], { tipoCob: "cob" });
      const qrlink = await efipay.pixGenerateQRCode({ id: loc.id });

      const txid = crypto.randomBytes(16).toString("hex");
      const efiParams = { txid };

      const body = {
        calendario: { expiracao: 3600 }, // Expira em 1 hora para serviços
        devedor:
          cleanCpf.length === 11
            ? { cpf: cleanCpf, nome: pppoe }
            : { cnpj: cleanCpf, nome: pppoe },
        valor: { original: valor },
        chave: chave_pix,
        solicitacaoPagador: "Pagamento de Serviço",
        infoAdicionais: [
          { nome: "ID", valor: String(idLancamento) },
          { nome: "VALOR", valor: valor },
          { nome: "QR", valor: String(qrlink.linkVisualizacao) },
        ],
        loc: { id: loc.id },
      };

      await efipay.pixCreateCharge(efiParams, body);

      return {
        link: qrlink.linkVisualizacao,
        qrcode: qrlink.qrcode, // Pix Copia e Cola
        txid: txid,
      };
    } catch (error) {
      console.error("❌ Erro ao gerar PIX de serviço:", error);
      throw error;
    }
  };

  // Gera um Pix único somando as mensalidades vencidas do cliente
  gerarPixAll = async (req: Request, res: Response): Promise<void> => {
    try {
      // 🔹 Extrai os dados do corpo da requisição
      let { pppoe, cpf } = req.body as { pppoe: string; cpf: string };

      // 🔹 Remove qualquer caractere não numérico do CPF/CNPJ
      cpf = cpf.replace(/\D/g, "");

      // 🔹 Busca no banco as mensalidades vencidas do cliente
      const clientes = await this.recordRepo.find({
        where: { login: pppoe, status: "vencido", datadel: IsNull() },
        order: { datavenc: "ASC" as const },
        take: 3, // pega até 3 últimas faturas vencidas
      });

      // 🔹 Se não houver mensalidades, retorna erro
      if (!clientes || clientes.length === 0) {
        res
          .status(404)
          .json("Usuário não encontrado ou sem mensalidades vencidas");
        return;
      }

      const cliente_ativado = await this.clienteRepo.findOne({
        where: { login: pppoe },
      });

      if (!cliente_ativado) {
        res.status(404).json("Usuário não encontrado");
        return;
      }

      // 🔹 Array para armazenar dados estruturados após aplicar juros/desconto
      const structuredData: { id: number; valor: number; dataVenc: Date }[] =
        [];

      // 🔹 Calcula o valor corrigido (com juros/desconto) para cada fatura
      for (let index = 0; index < clientes.length; index++) {
        const cliente = clientes[index];
        let valorCorrigido = await this.aplicarJuros_Desconto(
          cliente.valor, // valor original da fatura
          pppoe, // login do cliente
          cliente.datavenc, // data de vencimento
        );

        // if (index == 2 && cliente_ativado.cli_ativado === "s") {
        //   const valorOriginal = Number(valorCorrigido);
        //   const desconto = valorOriginal * 0.5;
        //   valorCorrigido = valorOriginal - desconto;
        // } else {
        //   valorCorrigido = Number(valorCorrigido);
        // }

        valorCorrigido = Number(valorCorrigido);

        structuredData.push({
          id: cliente.id,
          dataVenc: cliente.datavenc as Date,
          valor: Number(valorCorrigido),
        });
      }

      // 🔹 Soma o total de todas as mensalidades (já com juros/descontos)
      const total = structuredData
        .reduce((acc, c) => acc + Number(c.valor), 0)
        .toFixed(2);

      // 🔹 Instancia o cliente Efipay com suas credenciais
      const efipay = new EfiPay(options);

      // 🔹 Cria uma “localização” para o QR Code
      const loc = await efipay.pixCreateLocation([], { tipoCob: "cob" });

      // 🔹 Gera o QR Code com base nessa localização
      const qrlink = await efipay.pixGenerateQRCode({ id: loc.id });

      // 🔹 Cria o corpo da cobrança PIX (Pix único com soma total)
      const params = { txid: crypto.randomBytes(16).toString("hex") };

      // 🔹 Define se o cliente é pessoa física (CPF) ou jurídica (CNPJ)
      const body: any =
        cpf.length === 11
          ? {
              calendario: { expiracao: 43200 }, // 12h
              devedor: { cpf, nome: pppoe },
              valor: { original: total },
              chave: chave_pix,
              solicitacaoPagador: "Mensalidade",
              loc: { id: loc.id },
              infoAdicionais: [{ nome: "QR", valor: qrlink.linkVisualizacao }],
            }
          : {
              calendario: { expiracao: 43200 },
              devedor: { cnpj: cpf, nome: pppoe },
              valor: { original: total },
              chave: chave_pix,
              solicitacaoPagador: "Mensalidade",
              loc: { id: loc.id },
              infoAdicionais: [{ nome: "QR", valor: qrlink.linkVisualizacao }],
            };

      // 🔹 Adiciona informações de cada mensalidade dentro do campo adicional
      structuredData.forEach((c) => {
        body.infoAdicionais.push({ nome: "ID", valor: String(c.id) });
        body.infoAdicionais.push({ nome: "VALOR", valor: String(c.valor) });
        body.infoAdicionais.push({
          nome: "VENCIMENTO",
          valor: c.dataVenc.toISOString().split("T")[0],
        });
      });

      // 🔹 Cria a cobrança Pix única (somando todas as faturas)
      await efipay.pixCreateCharge(params, body);

      // 🔹 Retorna ao frontend os dados gerados
      res.status(200).json({
        valor: total,
        pppoe,
        link: qrlink.linkVisualizacao,
        mensalidades: structuredData,
      });
    } catch (error: any) {
      console.error("❌ Erro em gerarPixAll:", error);
      res.status(500).json({ erro: error.message || error });
    }
  };

  gerarPixVariasContas = async (req: Request, res: Response): Promise<void> => {
    try {
      // 🔹 Extrai os dados principais do corpo da requisição
      let { nome_completo, cpf } = req.body as {
        nome_completo: string;
        cpf: string;
      };

      // 🔹 Extrai os IDs dos títulos (ex: "101,102,103")
      const titulos: string[] = String(req.body.titulos || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      // 🔹 Normaliza os dados de entrada
      nome_completo = String(nome_completo || "").toUpperCase();
      cpf = String(cpf || "").replace(/[^\d]+/g, "");

      // 🔹 Busca as faturas no banco de dados com base nos IDs recebidos
      const clientes = await this.recordRepo.find({
        where: { id: In(titulos.map((t) => Number(t))) },
      });

      console.log(clientes);

      // 🔹 Se nenhuma fatura foi encontrada, retorna erro
      if (!clientes || clientes.length === 0) {
        res.status(404).json("Nenhum título válido encontrado");
        return;
      }

      // 🔹 Cria array com dados estruturados aplicando juros e desconto
      const structuredData: { id: number; dataVenc: Date; valor: number }[] =
        [];

      for (const cliente of clientes) {
        // 🔸 Chama a função centralizada de cálculo (sem duplicar lógica)
        const valorCorrigido = await this.aplicarJuros_Desconto(
          cliente.valor, // valor original da fatura
          cliente.login, // login (pppoe)
          cliente.datavenc, // data de vencimento
        );

        // 🔹 Armazena o resultado no array final
        structuredData.push({
          id: cliente.id,
          dataVenc: cliente.datavenc as Date,
          valor: Number(valorCorrigido),
        });
      }

      // 🔹 Soma o total corrigido
      const valorSomado = structuredData
        .reduce((acc, c) => acc + c.valor, 0)
        .toFixed(2);

      // 🔹 Instancia única do cliente Efipay
      const efipay = new EfiPay(options);

      // 🔹 Cria a localização e o QR Code
      const loc = await efipay.pixCreateLocation([], { tipoCob: "cob" });
      const qrlink = await efipay.pixGenerateQRCode({ id: loc.id });

      // 🔹 Corpo da cobrança PIX (único para CPF e CNPJ)
      const body: any = {
        calendario: { expiracao: 43200 },
        devedor:
          cpf.length === 11
            ? { cpf, nome: nome_completo }
            : { cnpj: cpf, nome: nome_completo },
        valor: { original: valorSomado },
        chave: chave_pix,
        solicitacaoPagador: "Mensalidade",
        loc: { id: loc.id },
        infoAdicionais: [{ nome: "QR", valor: qrlink.linkVisualizacao }],
      };

      // 🔹 Adiciona as informações de cada título (ID, valor e vencimento)
      structuredData.forEach((c) => {
        body.infoAdicionais.push({ nome: "ID", valor: String(c.id) });
        body.infoAdicionais.push({ nome: "VALOR", valor: String(c.valor) });
        body.infoAdicionais.push({
          nome: "VENCIMENTO",
          valor: c.dataVenc.toISOString().split("T")[0],
        });
      });

      // 🔹 Cria a cobrança PIX somando todos os títulos
      const params = { txid: crypto.randomBytes(16).toString("hex") };
      await efipay.pixCreateCharge(params, body);

      // 🔹 Retorna o resultado ao frontend
      res.status(200).json({
        valor: valorSomado,
        nome_completo,
        link: qrlink.linkVisualizacao,
        titulos: structuredData,
      });
    } catch (error: any) {
      console.error("❌ Erro em gerarPixVariasContas:", error);
      res.status(500).json({ erro: error.message || error });
    }
  };

  PixAutomaticoCriar = async (req: Request, res: Response): Promise<void> => {
    try {
      const { pixAutoData } = req.body;
      let {
        contrato,
        cpf,
        nome,
        servico,
        data_inicial,
        periodicidade,
        valor,
        politica,
        jornada,
        destinatario,
      } = pixAutoData;

      /**
       * Jornada de contratação (documentação do Pix Automático da Efí):
       * 1 = sem QR, a confirmação chega no app do banco do cliente (solicrec);
       * 2 = QR só de autorização, sem cobrar nada na hora;
       * 3 = QR que cobra a mensalidade em aberto e já autoriza a recorrência.
       */
      const tipoJornada = String(jornada ?? "3");

      if (!cpf) {
        res.status(500).json("Sem CPF");
        return;
      }

      const documento = cpf.replace(/\D/g, "");

      const validarCPF = (cpf: string): boolean => {
        if (!cpf || cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
        let soma = 0;
        for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
        let resto = (soma * 10) % 11;
        if (resto === 10 || resto === 11) resto = 0;
        if (resto !== parseInt(cpf[9])) return false;
        soma = 0;
        for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
        resto = (soma * 10) % 11;
        if (resto === 10 || resto === 11) resto = 0;
        return resto === parseInt(cpf[10]);
      };

      const validarCNPJ = (cnpj: string): boolean => {
        if (!cnpj || cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
        let tamanho = cnpj.length - 2;
        let numeros = cnpj.substring(0, tamanho);
        const digitos = cnpj.substring(tamanho);
        let soma = 0;
        let pos = tamanho - 7;
        for (let i = tamanho; i >= 1; i--) {
          soma += parseInt(numeros[tamanho - i]) * pos--;
          if (pos < 2) pos = 9;
        }
        let resto = soma % 11 < 2 ? 0 : 11 - (soma % 11);
        if (resto !== parseInt(digitos[0])) return false;
        tamanho = tamanho + 1;
        numeros = cnpj.substring(0, tamanho);
        soma = 0;
        pos = tamanho - 7;
        for (let i = tamanho; i >= 1; i--) {
          soma += parseInt(numeros[tamanho - i]) * pos--;
          if (pos < 2) pos = 9;
        }
        resto = soma % 11 < 2 ? 0 : 11 - (soma % 11);
        return resto === parseInt(digitos[1]);
      };

      const isCPF = validarCPF(documento);
      const isCNPJ = validarCNPJ(documento);

      const cliente = await this.recordRepo.findOne({
        where: { login: nome, status: Not("pago"), datadel: IsNull() },
        order: { datavenc: "ASC" as const },
      });

      // Só a jornada 3 cobra na hora, então só ela precisa de mensalidade aberta.
      if (!cliente && tipoJornada === "3") {
        throw new Error(
          `Usuário ${nome} não encontrado ou sem mensalidades vencidas`,
        );
      }

      const efipay = new EfiPay(options);

      // A jornada 1 não usa QR Code, logo não precisa de location.
      const locResponse =
        tipoJornada === "1"
          ? null
          : await efipay.pixCreateLocationRecurrenceAutomatic();

      console.log(locResponse);

      const params = { txid: crypto.randomBytes(16).toString("hex") };

      const num = Number(String(valor).replace(",", "."));
      console.log(num.toFixed(2));

      // Cobrança imediata: só existe na jornada 3, e é ela que cobra na hora.
      // Fora da jornada 3 essa cobrança ficaria solta, sem vínculo com a
      // recorrência, e o cliente poderia pagá-la por engano.
      //
      // Ela fica com location própria: a location da recorrência não pode ser
      // reaproveitada aqui ("location_em_uso"). O que liga as duas é o txid
      // desta cobrança, informado em ativacao.dadosJornada na recorrência —
      // e é a partir dele que a Efí monta o QR combinado.
      let cobrancaImediata: any = null;
      if (tipoJornada === "3") {
        const payload1 = {
          calendario: { expiracao: 3600 },
          chave: String(process.env.CHAVE_PIX),
          valor: { original: num.toFixed(2) },
          devedor: isCPF ? { nome, cpf: documento } : { nome, cnpj: documento },
          // O par ID/VALOR, nesta ordem, é o que o webhook do Pix usa para
          // baixar a mensalidade no MKAuth. Com outro nome (TITULO, por
          // exemplo) o pagamento entra e a fatura fica em aberto.
          infoAdicionais: [
            { nome: "ID", valor: String(cliente!.id) },
            { nome: "VALOR", valor: num.toFixed(2) },
          ],
          solicitacaoPagador: "Mensalidade",
        };

        console.log(params.txid);
        console.log(options.sandbox);

        cobrancaImediata = await efipay.pixCreateCharge(params, payload1);

        console.log(cobrancaImediata);
      }

      if (data_inicial.includes("/")) {
        const [dia, mes, ano] = data_inicial.split("/");
        data_inicial = `${ano}-${mes}-${dia}`;
      }

      valor = parseFloat(valor);

      if (isNaN(valor)) {
        res.status(400).json({
          error: "O campo 'valor' deve ser um número válido.",
        });
        return;
      }

      valor = valor.toFixed(2);

      console.log(
        contrato,
        cpf,
        nome,
        servico,
        data_inicial,
        periodicidade,
        valor,
        politica,
      );

      if (!isCPF && !isCNPJ) {
        res.status(400).json({ error: "CPF/CNPJ inválido" });
        return;
      }

      const payload2: any = {
        calendario: { dataInicial: data_inicial, periodicidade },
        politicaRetentativa: politica,
        valor: { valorRec: num.toFixed(2) },
        vinculo: {
          contrato,
          devedor: isCPF ? { nome, cpf: documento } : { nome, cnpj: documento },
          objeto: String(servico || "Mensalidade").slice(0, 35),
        },
      };

      if (locResponse) payload2.loc = locResponse.id;

      // É esse vínculo que faz o QR cobrar a mensalidade e autorizar a
      // recorrência no mesmo pagamento (jornada 3).
      if (tipoJornada === "3") {
        payload2.ativacao = { dadosJornada: { txid: params.txid } };
      }

      const responseRecurrence = await efipay.pixCreateRecurrenceAutomatic(
        "",
        payload2,
      );

      // Jornada 1: a confirmação chega no app do banco do cliente, então
      // precisa dos dados da conta dele (agência, conta e ISPB do banco).
      let solicitacao = null;
      if (tipoJornada === "1") {
        if (
          !destinatario?.agencia ||
          !destinatario?.conta ||
          !destinatario?.ispbParticipante
        ) {
          res.status(400).json({
            error:
              "Para a jornada 1 informe agência, conta e ISPB do banco do cliente.",
          });
          return;
        }

        const expiracao =
          destinatario.dataExpiracaoSolicitacao ||
          new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split(".")[0] + "Z";

        solicitacao = await efipay.pixCreateRequestRecurrenceAutomatic("", {
          idRec: responseRecurrence.idRec,
          calendario: { dataExpiracaoSolicitacao: expiracao },
          destinatario: {
            ...(isCPF ? { cpf: documento } : { cnpj: documento }),
            agencia: String(destinatario.agencia),
            conta: String(destinatario.conta),
            ispbParticipante: String(destinatario.ispbParticipante),
          },
        });

        console.log(solicitacao);
      }

      // O QR combinado da jornada 3 só vem quando o txid da cobrança imediata
      // é informado AQUI, como query param da consulta da recorrência. Sem
      // ele a Efí devolve o QR que apenas autoriza, e o cliente acaba
      // autorizando a recorrência sem pagar a mensalidade.
      const response = await efipay.pixDetailRecurrenceAutomatic({
        idRec: responseRecurrence.idRec,
        ...(cobrancaImediata?.txid ? { txid: cobrancaImediata.txid } : {}),
      });

      console.log(response);
      // A Efí diz aqui qual jornada o QR carrega. Jornada 3 é o QR que cobra e
      // autoriza junto; qualquer outra coisa significa que o vínculo com a
      // cobrança imediata não pegou.
      console.log(
        `[Pix Automático] jornada pedida=${tipoJornada} | dadosQR.jornada=${response?.dadosQR?.jornada ?? "(ausente)"} | txid da cobrança=${cobrancaImediata?.txid ?? "-"}`,
      );

      res.status(200).json({
        ...response,
        solicitacao,
        jornada: tipoJornada,
        // Vai separado para a tela saber qual QR mostrar: o que cobra agora
        // (jornada 3) ou o que apenas autoriza (jornada 2).
        cobrancaImediata: cobrancaImediata
          ? {
              txid: cobrancaImediata.txid,
              valor: cobrancaImediata.valor?.original,
              pixCopiaECola: cobrancaImediata.pixCopiaECola,
            }
          : null,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json(error);
    }
  };

  pegarUltimoBoletoGerarPixAutomaticoSimular = async (
    req: Request,
    res: Response,
  ) => {
    try {
      const todasAsCobsr: any[] = [];
      let paginaAtual = 0;
      let quantidadeDePaginas = 1;

      const efipay = new EfiPay(options);
      const hoje = new Date().toISOString().split(".")[0] + "Z";

      while (paginaAtual < quantidadeDePaginas) {
        const response = await efipay.pixListRecurrenceAutomatic({
          inicio: "2025-10-18T00:00:00Z",
          fim: hoje,
          status: "APROVADA",
          "paginacao.itensPorPagina": 100,
          "paginacao.paginaAtual": paginaAtual,
        });

        todasAsCobsr.push(...response.recs);
        quantidadeDePaginas = response.parametros.paginacao.quantidadeDePaginas;
        paginaAtual++;
      }

      console.log(todasAsCobsr);

      const response = await Promise.allSettled(
        todasAsCobsr.map(async (f) => {
          const agora = new Date();
          const inicioDoMes = new Date(
            agora.getFullYear(),
            agora.getMonth(),
            1,
          );
          const fimDoMes = new Date(
            agora.getFullYear(),
            agora.getMonth() + 1,
            0,
            23,
            59,
            59,
          );

          // 🔹 Busca o cliente no banco de dados
          const cliente = await this.recordRepo.findOne({
            where: {
              login: f.vinculo.devedor.nome,
              status: Not("pago"),
              datadel: IsNull(),
              datavenc: Between(inicioDoMes, fimDoMes),
            },
            order: { datavenc: "ASC" as const },
          });

          console.log(f.vinculo.devedor.nome);

          // 🔸 Se não encontrar, apenas loga (não pode usar res.status dentro do loop)
          if (!cliente) {
            console.warn(
              `Usuário ${f.pppoe} não encontrado ou sem mensalidades vencidas`,
            );
            return null; // sai desta iteração
          }

          const cadastroCliente = await this.clienteRepo.findOne({
            where: { login: cliente.login },
          });

          console.log(Number(cliente.valor) - cadastroCliente?.desconto!);
          const valorComDesconto =
            Number(cliente.valor) - cadastroCliente?.desconto!;

          // 🔹 Cria cobrança automática vinculada a uma recorrência
          const result = await efipay.pixCreateAutomaticCharge("", {
            idRec: f.idRec, // ID da recorrência já existente
            ajusteDiaUtil: true, // Ajusta vencimento se cair em fim de semana
            calendario: {
              dataDeVencimento: cliente.datavenc.toISOString().split("T")[0], // Data da cobrança
              // dataDeVencimento: '2025-10-24', // Data da cobrança
            },
            recebedor: {
              agencia: process.env.AGENCIA!,
              conta: process.env.CONTA!,
              tipoConta: "PAGAMENTO", // Tipo da conta bancária
            },
            valor: {
              original: valorComDesconto.toFixed(2), // Valor da cobrança
              // original: '1.00'
            },
            infoAdicional: "Mensalidade gerada automaticamente",
          });

          console.log(`Cobrança criada para ${cliente.login}:`, result);
          return result;
        }),
      );

      console.log(response);

      res.status(200).json(response);
    } catch (error) {
      console.log(error);
      res.status(500).json(error);
    }
  };

  pegarUltimoBoletoGerarPixAutomatico = async () => {
    try {
      const todasAsCobsr: any[] = [];
      let paginaAtual = 0;
      let quantidadeDePaginas = 1;

      const efipay = new EfiPay(options);
      const hoje = new Date().toISOString().split(".")[0] + "Z";

      while (paginaAtual < quantidadeDePaginas) {
        const response = await efipay.pixListRecurrenceAutomatic({
          inicio: "2025-10-18T00:00:00Z",
          fim: hoje,
          status: "APROVADA",
          "paginacao.itensPorPagina": 100,
          "paginacao.paginaAtual": paginaAtual,
        });

        todasAsCobsr.push(...response.recs);
        quantidadeDePaginas = response.parametros.paginacao.quantidadeDePaginas;
        paginaAtual++;
      }

      console.log(todasAsCobsr);

      const response = await Promise.allSettled(
        todasAsCobsr.map(async (f) => {
          const agora = new Date();
          const inicioDoMes = new Date(
            agora.getFullYear(),
            agora.getMonth(),
            1,
          );
          const fimDoMes = new Date(
            agora.getFullYear(),
            agora.getMonth() + 1,
            0,
            23,
            59,
            59,
          );

          // 🔹 Busca o cliente no banco de dados
          const cliente = await this.recordRepo.findOne({
            where: {
              login: f.vinculo.devedor.nome,
              status: Not("pago"),
              datadel: IsNull(),
              datavenc: Between(inicioDoMes, fimDoMes),
            },
            order: { datavenc: "ASC" as const },
          });
          // 🔸 Se não encontrar, apenas loga (não pode usar res.status dentro do loop)
          if (!cliente) {
            console.warn(
              `Usuário ${f.pppoe} não encontrado ou sem mensalidades vencidas`,
            );
            return null; // sai desta iteração
          }

          const cadastroCliente = await this.clienteRepo.findOne({
            where: { login: cliente.login },
          });

          console.log(Number(cliente.valor) - cadastroCliente?.desconto!);
          const valorComDesconto =
            Number(cliente.valor) - cadastroCliente?.desconto!;

          // 🔹 Cria cobrança automática vinculada a uma recorrência
          const result = await efipay.pixCreateAutomaticCharge("", {
            idRec: f.idRec, // ID da recorrência já existente
            ajusteDiaUtil: true, // Ajusta vencimento se cair em fim de semana
            calendario: {
              dataDeVencimento: cliente.datavenc.toISOString().split("T")[0], // Data da cobrança
              // dataDeVencimento: '2025-10-24', // Data da cobrança
            },
            recebedor: {
              agencia: process.env.AGENCIA!,
              conta: process.env.CONTA!,
              tipoConta: "PAGAMENTO", // Tipo da conta bancária
            },
            valor: {
              original: valorComDesconto.toFixed(2), // Valor da cobrança
              // original: '1.00'
            },
            infoAdicional: "Mensalidade gerada automaticamente",
          });

          console.log(`Cobrança criada para ${cliente.login}:`, result);
          return result;
        }),
      );
      console.log(response);
    } catch (error) {
      console.log(error);
    }
  };

  cancelarCobranca = async (req: Request, res: Response) => {
    try {
      const { txid } = req.body;
      const efi = new EfiPay(options);
      const response = await efi.pixUpdateAutomaticCharge(
        { txid: txid },
        { status: "CANCELADA" },
      );
      console.log(response);
      res.status(200).json(response);
    } catch (error) {
      res.status(500).json(error);
    }
  };

  /**
   * Jornada 1: consulta a solicitação de confirmação enviada ao app do banco.
   */
  buscarSolicitacaoRecorrencia = async (req: Request, res: Response) => {
    try {
      const { idSolicRec } = req.body;
      if (!idSolicRec) {
        res.status(400).json({ error: "Informe o idSolicRec." });
        return;
      }
      const efi = new EfiPay(options);
      const response = await efi.pixDetailRequestRecurrenceAutomatic({
        idSolicRec,
      });
      res.status(200).json(response);
    } catch (error) {
      console.log(error);
      res.status(500).json(error);
    }
  };

  /**
   * Jornada 1: cancela a solicitação enquanto ela ainda está CRIADA ou RECEBIDA.
   */
  cancelarSolicitacaoRecorrencia = async (req: Request, res: Response) => {
    try {
      const { idSolicRec } = req.body;
      if (!idSolicRec) {
        res.status(400).json({ error: "Informe o idSolicRec." });
        return;
      }
      const efi = new EfiPay(options);
      const response = await efi.pixUpdateRequestRecurrenceAutomatic(
        { idSolicRec },
        { status: "CANCELADA" },
      );
      res.status(200).json(response);
    } catch (error) {
      console.log(error);
      res.status(500).json(error);
    }
  };

  /**
   * Nova tentativa de uma cobrança que não foi paga. Só funciona quando a
   * recorrência foi criada com a política PERMITE_3R_7D.
   */
  solicitarRetentativaCobranca = async (req: Request, res: Response) => {
    try {
      const { txid, data } = req.body;
      if (!txid || !data) {
        res
          .status(400)
          .json({ error: "Informe o txid e a data da nova tentativa." });
        return;
      }
      const efi = new EfiPay(options);
      const response = await efi.pixRetryRequestAutomaticCharge({
        txid,
        data: String(data).slice(0, 10),
      });
      res.status(200).json(response);
    } catch (error) {
      console.log(error);
      res.status(500).json(error);
    }
  };

  /**
   * Lista as cobranças do Pix Automático de um período, seguindo as páginas
   * até o fim. Sem período, usa o mês corrente.
   */
  listarCobrancasPixAutomatico = async (req: Request, res: Response) => {
    try {
      const { inicio, fim, status, idRec, cpf } = req.body ?? {};

      const agora = new Date();
      const inicioPadrao = new Date(agora.getFullYear(), agora.getMonth(), 1);
      const fimPadrao = new Date(
        agora.getFullYear(),
        agora.getMonth() + 1,
        0,
        23,
        59,
        59,
      );

      /**
       * A Efí exige a data no formato AAAA-MM-DDTHH:MM:SSZ, sem milissegundos.
       * Recorta sempre a partir do ISO completo: tentar "cortar o milissegundo"
       * de um texto que já vinha sem ponto acabava gerando dois Z no fim.
       */
      const paraFormatoEfi = (valor: string | Date, padrao: Date) => {
        const data = valor ? new Date(valor) : padrao;
        const valida = isNaN(data.getTime()) ? padrao : data;
        return valida.toISOString().split(".")[0] + "Z";
      };

      const efi = new EfiPay(options);
      const cobsr: any[] = [];
      let paginaAtual = 0;
      let quantidadeDePaginas = 1;
      let parametros: any = null;

      while (paginaAtual < quantidadeDePaginas) {
        const params: any = {
          inicio: paraFormatoEfi(inicio, inicioPadrao),
          fim: paraFormatoEfi(fim, fimPadrao),
          "paginacao.itensPorPagina": 100,
          "paginacao.paginaAtual": paginaAtual,
        };
        if (status && status !== "TODOS") params.status = status;
        if (idRec) params.idRec = idRec;
        if (cpf) params.cpf = String(cpf).replace(/\D/g, "");

        const response = await efi.pixListAutomaticCharge(params);
        cobsr.push(...(response.cobsr ?? []));
        parametros = response.parametros;
        quantidadeDePaginas =
          response.parametros?.paginacao?.quantidadeDePaginas ?? 1;
        paginaAtual++;
      }

      res.status(200).json({ parametros, cobsr });
    } catch (error) {
      console.log(error);
      res.status(500).json(error);
    }
  };

  buscarCobranca = async (req: Request, res: Response) => {
    try {
      const { txid } = req.body;
      const efi = new EfiPay(options);
      const response = await efi.pixDetailAutomaticCharge({ txid: txid });
      console.log(response);
      res.status(200).json(response);
    } catch (error) {
      res.status(500).json(error);
    }
  };

  listaPixAutomatico = async (req: Request, res: Response): Promise<void> => {
    try {
      const { filtros } = req.body;

      const efi = new EfiPay(options);
      const hoje = new Date().toISOString().split(".")[0] + "Z";

      const inicio = "2025-10-22T00:00:00Z";

      if (filtros && filtros.status && filtros.status != "TODOS") {
        const response = await efi.pixListRecurrenceAutomatic({
          inicio: inicio,
          status: filtros.status,
          fim: hoje,
          "paginacao.itensPorPagina": 2000,
        });
        res.status(200).json(response);
        return;
      }

      const response = await efi.pixListRecurrenceAutomatic({
        inicio: inicio,
        fim: hoje,

        "paginacao.itensPorPagina": 100,
      });
      res.status(200).json(response);
    } catch (error) {
      console.log(error);

      res.status(500).json(error);
    }
  };

  listarPixAutomaticoUmCliente = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const { filtros } = req.body;
      console.log(filtros.idRec);

      const efi = new EfiPay(options);
      const response = await efi.pixDetailRecurrenceAutomatic({
        idRec: filtros.idRec,
      });
      const response2 = await this.listarPixAgendados(filtros.idRec);

      const finalResponse = {
        response,
        response2,
      };

      res.status(200).json(finalResponse);
    } catch (error) {
      console.log(error);

      res.status(500).json(error);
    }
  };

  listarPixAgendados = async (idRec: string) => {
    try {
      const efipay = new EfiPay(options);

      const hoje = new Date().toISOString().split(".")[0] + "Z";
      const response = await efipay.pixListAutomaticCharge({
        idRec: idRec,
        inicio: "2025-10-17T00:00:00Z",
        fim: hoje,
      });
      return response;
    } catch (error) {
      return error;
    }
  };

  atualizarPixAutomatico = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const { idRec, status } = req.body;
      console.log(idRec, status);

      const efipay = new EfiPay(options);
      const response = await efipay.pixUpdateRecurrenceAutomatic(
        { idRec: idRec },
        { status: status },
      );
      res.status(200).json(response);
    } catch (error) {
      res.status(500).json(error);
    }
  };

  simularPagamentoWebhookPixAutomatico = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const efipay = new EfiPay(options);

      const simular = req.body;

      console.log(simular);

      const response = await efipay.pixDetailRecurrenceAutomatic({
        idRec: simular.cobsr[0].idRec,
      });

      console.log(response);

      const cliente = await this.recordRepo.findOne({
        where: {
          login: response.vinculo.devedor.nome,
          status: Not("pago"),
          datadel: IsNull(),
        },
        order: { datavenc: "ASC" as const },
      });

      console.log(cliente);

      const fatura = await this.recordRepo.update(String(cliente?.id), {
        status: "pago",
        coletor: "api_mk_pedro",
        formapag: "pix_automatico",
      });

      console.log(fatura);

      res.status(200).json(fatura);
    } catch (error) {
      console.log(error);

      res.status(500).json(error);
    }
  };

  listarTodasCobrancas = async (
    inicio: string, // recebe a data/hora inicial em ISO
    fim: string, // recebe a data/hora final em ISO
    status = "CONCLUIDA", // por padrão busca somente CONCLUIDA
  ) => {
    const efi = new EfiPay(options); // instancia o cliente EfiPay
    const todasCobs: any[] = []; // acumulador de todas as cobranças coletadas
    const vistos = new Set<string>(); // conjunto para deduplicar por txid

    let start = new Date(inicio); // cursor de início da janela atual
    const endFinal = new Date(fim); // limite final absoluto do período
    let janelaMs = 6 * 60 * 60 * 1000; // tamanho da janela (6h) — adaptativo

    while (start <= endFinal) {
      // laço até cobrir todo o período
      const end = new Date(
        // calcula o fim da janela atual
        Math.min(start.getTime() + janelaMs, endFinal.getTime()), // não ultrapassa o fim final
      );

      const resp = await efi.pixListCharges({
        // chama a API para a janela atual
        inicio: start.toISOString(), // início da janela em ISO
        fim: end.toISOString(), // fim da janela em ISO
        status, // filtro de status
      });

      const cobs = resp.cobs || []; // extrai as cobranças da resposta

      if (cobs.length >= 100 && janelaMs > 60 * 1000) {
        // se bateu o limite (100) e a janela ainda é > 1min
        janelaMs = Math.max(Math.floor(janelaMs / 2), 60 * 1000); // reduz a janela pela metade (mínimo 1min)
        continue; // refaz a mesma janela (start igual) com menor duração
      }

      for (const c of cobs) {
        // itera sobre as cobranças retornadas
        const key = c.txid || `${c.chave}-${c.calendario?.criacao}`; // chave única para deduplicação (prioriza txid)
        if (!vistos.has(key)) {
          // se ainda não vimos esta cobrança
          vistos.add(key); // marca como vista
          todasCobs.push(c); // adiciona ao acumulado
        }
      }

      start = new Date(end.getTime() + 1000); // avança o cursor para 1s após o fim da janela
      if (cobs.length < 50 && janelaMs < 24 * 60 * 60 * 1000) {
        // se veio pouco dado, podemos acelerar aumentando a janela
        janelaMs = Math.min(janelaMs * 2, 24 * 60 * 60 * 1000); // dobra a janela até no máx. 24h
      }
    }

    return {
      // retorna no mesmo formato que você já usa
      parametros: {
        inicio, // início original solicitado
        fim, // fim original solicitado
        totalCobrancas: todasCobs.length, // total após deduplicação
      },
      cobs: todasCobs, // lista completa (única) de cobranças
    };
  };

  BuscarPixPago = async (req: Request, res: Response) => {
    try {
      const efi = new EfiPay(options);
      const response = await efi.pixDetailCharge({ txid: req.body.chargeId });
      console.log(response);

      res.status(200).json(response);
    } catch (error) {
      res.status(500).json(error);
    }
  };

  BuscarPixPagoData = async (req: Request, res: Response) => {
    try {
      const { inicio, fim } = req.body;
      const response = await this.listarTodasCobrancas(
        inicio,
        fim,
        "CONCLUIDA",
      );
      res.status(200).json(response);
    } catch (error) {
      res.status(500).json(error);
    }
  };

  ReenviarNotificacoes = async (req: Request, res: Response) => {
    try {
      const { inicio, fim } = req.body;
      const efi = new EfiPay(options);

      const response = await this.listarTodasCobrancas(
        inicio,
        fim,
        "CONCLUIDA",
      );

      const e2eids: string[] = [];

      for (const cob of response.cobs || []) {
        if (cob.pix && Array.isArray(cob.pix)) {
          for (const pix of cob.pix) {
            if (pix.endToEndId) e2eids.push(pix.endToEndId);
          }
        }
      }

      if (e2eids.length === 0) {
        res.status(200).json({ message: "Nenhum endToEndId encontrado" });
        return;
      }

      const result = await efi.pixResendWebhook(
        {},
        { tipo: "PIX_RECEBIDO", e2eids },
      );

      res.status(200).json({ reenviados: e2eids, result });
    } catch (error) {
      res.status(500).json(error);
    }
  };
}

export default Pix;
