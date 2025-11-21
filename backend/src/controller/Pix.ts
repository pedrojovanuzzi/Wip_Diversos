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

dotenv.config();

const logFilePath = path.join(__dirname, "..", "..", "/log", "logPix.json");
const isSandbox = process.env.SERVIDOR_HOMOLOGACAO === "true";

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
    : path.resolve("src", "files", process.env.CERTIFICATE_PROD!),
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
        { webhookUrl: String(urlWebhook) }
      );
      res.status(200).json(response);
    } catch (error) {
      res.status(500).json(error);
    }
  };

  AlterarWebhookPixAutomatico = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { urlWebhook } = req.body;
      console.log(urlWebhook);

      options.validateMtls = false;
      const efipay = new EfiPay(options);
      const response = await efipay.pixConfigWebhookAutomaticCharge(
        {},
        { webhookUrl: String(urlWebhook) }
      );
      res.status(200).json(response);
    } catch (error) {
      res.status(500).json(error);
    }
  };

  aplicarJuros_Desconto = async (
    valor: string | number,
    pppoe: string,
    dataVenc: Date | string
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
        dataVencimento.toLocaleDateString()
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
    pppoe: string
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

  AlterarWebhookPixAutomaticoRecorrencia = async (
    req: Request,
    res: Response
  ): Promise<void> => {
    try {
      const { urlWebhookRecurrency } = req.body;
      console.log(urlWebhookRecurrency);

      options.validateMtls = false;
      const efipay = new EfiPay(options);
      const response = await efipay.pixConfigWebhookRecurrenceAutomatic(
        {},
        { webhookUrl: String(urlWebhookRecurrency) }
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
            `${clientId}:${clientSecret}`
          ).toString("base64")}`,
        },
      });
      return response.data.access_token;
    } catch (error: any) {
      console.error(
        "Erro ao obter token:",
        error.response?.data || error.message
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
    res: Response
  ): Promise<void> => {
    try {
      const pixData = req.body.pix;

      console.log(pixData);

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
      if (status !== "CONCLUIDA") {
        res.status(200).json({ message: "PIX ainda não concluído", status });
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

        const sis_cliente = await this.clienteRepo.findOne({
          where: { login: record_pppoe.login },
        });

        if (sis_cliente) {
          const remObsDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
            .toISOString()
            .replace("T", " ")
            .replace("Z", "");
          await this.clienteRepo.update(
            { login: sis_cliente.login },
            { observacao: "sim", rem_obs: remObsDate }
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

  PixAutomaticWebhookCobr = async (req: Request, res: Response) => {
    try {
      const efipay = new EfiPay(options);

      const cobr = req.body;

      console.log(cobr);

      if (!cobr.cobsr) {
        res.status(200).json();
        return;
      }

      const response = await efipay.pixDetailRecurrenceAutomatic({
        idRec: cobr.cobsr[0].idRec,
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
        valorpag:
          response.valor.valorRec ?? response.valor.valorMinimoRecebedor,
        datapag: new Date(),
      });

      console.log(fatura);

      res.status(200).json(fatura);
    } catch (error) {
      console.log(error);

      res.status(500).json(error);
    }
  };

  PixAutomaticWebhookRec = async (req: Request, res: Response) => {
    try {
      const efipay = new EfiPay(options);

      const cobr = req.body;

      console.log(cobr);

      if (!cobr.cobsr) {
        res.status(200).json();
        return;
      }

      const response = await efipay.pixDetailRecurrenceAutomatic({
        idRec: cobr.cobsr[0].idRec,
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
        valorpag:
          response.valor.valorRec ?? response.valor.valorMinimoRecebedor,
        datapag: new Date(),
      });

      console.log(fatura);

      res.status(200).json(fatura);
    } catch (error) {
      console.log(error);

      res.status(500).json(error);
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
        dataVenc
      );

      const valorFinal = Number(valorDesconto).toFixed(2);

      if (perdoarjuros) {
        let valorPerdoado: string | number = await this.aplicar_Desconto(
          cliente.valor,
          pppoe
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
          cliente.datavenc as Date
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
          cliente.datavenc as Date
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
      let { pppoe, cpf } = req.body as { pppoe: string; cpf: string };
      cpf = cpf.replace(/\D/g, "");

      const cliente = await this.recordRepo.findOne({
        where: { login: pppoe, status: "aberto", datadel: IsNull() },
        order: { datavenc: "ASC" as const },
      });

      if (!cliente) {
        res
          .status(500)
          .json(
            "Usuário não encontrado, desativado ou sem mensalidades abertas"
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
        dataVenc
      );

      const valorFinal = Number(valorDesconto).toFixed(2);

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
    } catch (error: any) {
      console.error("Erro em gerarPixAberto:", error);
      res.status(500).json(error);
      return;
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

      // 🔹 Array para armazenar dados estruturados após aplicar juros/desconto
      const structuredData: { id: number; valor: number; dataVenc: Date }[] =
        [];

      // 🔹 Calcula o valor corrigido (com juros/desconto) para cada fatura
      for (const [index, cliente] of clientes.entries()) {
        let valorCorrigido = await this.aplicarJuros_Desconto(
          cliente.valor, // valor original da fatura
          pppoe, // login do cliente
          cliente.datavenc // data de vencimento
        );

        if (index == 2) {
          const valorOriginal = Number(valorCorrigido);
          const desconto = valorOriginal * 0.5;
          valorCorrigido = valorOriginal - desconto;
        }

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
          cliente.datavenc // data de vencimento
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
      } = pixAutoData;

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

      if (!cliente) {
        throw new Error(
          `Usuário ${nome} não encontrado ou sem mensalidades vencidas`
        );
      }

      const efipay = new EfiPay(options);

      const locResponse = await efipay.pixCreateLocationRecurrenceAutomatic();

      console.log(locResponse);

      const params = { txid: crypto.randomBytes(16).toString("hex") };

      const num = Number(String(valor).replace(",", "."));
      console.log(num.toFixed(2));

      const payload1 = {
        calendario: { expiracao: 3600 },
        chave: String(process.env.CHAVE_PIX),
        valor: { original: num.toFixed(2) },
        // loc: {id: locResponse.id},
        devedor: isCPF ? { nome, cpf: documento } : { nome, cnpj: documento },
        infoAdicionais: [{ nome: "TITULO", valor: String(cliente.id) }],
        solicitacaoPagador: "Mensalidade",
      };

      console.log(params.txid);
      console.log(options.sandbox);

      const cobv = await efipay.pixCreateCharge(params, payload1);

      console.log(cobv);

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
        politica
      );

      if (!isCPF && !isCNPJ) {
        res.status(400).json({ error: "CPF/CNPJ inválido" });
        return;
      }

      const payload2 = {
        calendario: { dataInicial: data_inicial, periodicidade },
        politicaRetentativa: politica,
        // ativacao: {dadosJornada: {txid: }},
        loc: locResponse.id,
        valor: { valorRec: num.toFixed(2) },
        vinculo: {
          contrato,
          devedor: isCPF ? { nome, cpf: documento } : { nome, cnpj: documento },
        },
      };

      const responseRecurrence = await efipay.pixCreateRecurrenceAutomatic(
        "",
        payload2
      );

      const response = await efipay.pixDetailRecurrenceAutomatic({
        idRec: responseRecurrence.idRec,
      });

      console.log(response);

      res.status(200).json(response);
    } catch (error) {
      console.error(error);
      res.status(500).json(error);
    }
  };

  pegarUltimoBoletoGerarPixAutomaticoSimular = async (
    req: Request,
    res: Response
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
            1
          );
          const fimDoMes = new Date(
            agora.getFullYear(),
            agora.getMonth() + 1,
            0,
            23,
            59,
            59
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
              `Usuário ${f.pppoe} não encontrado ou sem mensalidades vencidas`
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
        })
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
            1
          );
          const fimDoMes = new Date(
            agora.getFullYear(),
            agora.getMonth() + 1,
            0,
            23,
            59,
            59
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
              `Usuário ${f.pppoe} não encontrado ou sem mensalidades vencidas`
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
        })
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
        { status: "CANCELADA" }
      );
      console.log(response);
      res.status(200).json(response);
    } catch (error) {
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
    res: Response
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
    res: Response
  ): Promise<void> => {
    try {
      const { idRec, status } = req.body;
      console.log(idRec, status);

      const efipay = new EfiPay(options);
      const response = await efipay.pixUpdateRecurrenceAutomatic(
        { idRec: idRec },
        { status: status }
      );
      res.status(200).json(response);
    } catch (error) {
      res.status(500).json(error);
    }
  };

  simularPagamentoWebhookPixAutomatico = async (
    req: Request,
    res: Response
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
    status = "CONCLUIDA" // por padrão busca somente CONCLUIDA
  ) => {
    const efi = new EfiPay(options); // instancia o cliente EfiPay
    const todasCobs: any[] = []; // acumulador de todas as cobranças coletadas
    const vistos = new Set<string>(); // conjunto para deduplicar por txid

    let start = new Date(inicio); // cursor de início da janela atual
    const endFinal = new Date(fim); // limite final absoluto do período
    let janelaMs = 6 * 60 * 60 * 1000; // tamanho da janela (6h) — adaptativo

    while (start <= endFinal) {
      // laço até cobrir todo o período
      const end = new Date( // calcula o fim da janela atual
        Math.min(start.getTime() + janelaMs, endFinal.getTime()) // não ultrapassa o fim final
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
        "CONCLUIDA"
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
        "CONCLUIDA"
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
        { tipo: "PIX_RECEBIDO", e2eids }
      );

      res.status(200).json({ reenviados: e2eids, result });
    } catch (error) {
      res.status(500).json(error);
    }
  };
}

export default Pix;
