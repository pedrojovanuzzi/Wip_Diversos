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
import { IsNull, Not } from "typeorm";

dotenv.config();

const __dirname = path.resolve();
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

  AlterarWebhook(url: string, chave: string): void {
    options.validateMtls = false;
    const efipay = new EfiPay(options);
    efipay
      .pixConfigWebhook({ chave: String(chave) }, { webhookUrl: String(url) })
      .then(console.log)
      .catch(console.log);
  }

  async AlterarWebhookPixAutomatico(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { urlWebhook } = req.body;
      console.log(urlWebhook);

      options.validateMtls = false;
      const efipay = new EfiPay(options);
      const response = await efipay.pixConfigWebhookRecurrenceAutomatic(
        {},
        { webhookUrl: String(urlWebhook) }
      );
      res.status(200).json(response);
    } catch (error) {
      res.status(500).json(error);
    }
  }

  async getAccessToken(): Promise<string | null> {
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
  }

  async setPaid(token: string, chargeId: string): Promise<any> {
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
  }

  async StatusUpdatePixTodosVencidos(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const pixData = req.body.pix;
      if (!pixData || pixData.length === 0) {
        res.status(400).json("Nenhum dado de PIX recebido");
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
  }

  async testwebhook(req: Request, res: Response) {
    console.log("wfwe");

    res.status(200).json();
  }

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

  async gerarPix(req: Request, res: Response): Promise<void> {
    try {
      let { pppoe, cpf } = req.body as { pppoe: string; cpf: string };
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

      const valor = Number(cliente.valor).toFixed(2);
      const params = { txid: crypto.randomBytes(16).toString("hex") };
      const body =
        cpf.length === 11
          ? {
              calendario: { expiracao: 43200 },
              devedor: { cpf, nome: pppoe },
              valor: { original: valor },
              chave: chave_pix,
              solicitacaoPagador: "Mensalidade",
              infoAdicionais: [
                { nome: "ID", valor: String(cliente.id) },
                { nome: "VALOR", valor: String(valor) },
                { nome: "QR", valor: String(qrlink.linkVisualizacao) },
              ],
              loc: { id: loc.id },
            }
          : {
              calendario: { expiracao: 43200 },
              devedor: { cnpj: cpf, nome: pppoe },
              valor: { original: valor },
              chave: chave_pix,
              solicitacaoPagador: "Mensalidade",
              infoAdicionais: [
                { nome: "ID", valor: String(cliente.id) },
                { nome: "VALOR", valor: String(valor) },
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

      res
        .status(200)
        .json({ valor, pppoe, link: qrlink.linkVisualizacao, formattedDate });
      return;
    } catch (error: any) {
      console.error("Erro em gerarPix:", error);
      res.status(500).json(error);
      return;
    }
  }

  async gerarPixAberto(req: Request, res: Response): Promise<void> {
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
      const body =
        cpf.length === 11
          ? {
              calendario: { expiracao: 43200 },
              devedor: { cpf, nome: pppoe },
              valor: { original: valor },
              chave: chave_pix,
              solicitacaoPagador: "Mensalidade",
              infoAdicionais: [
                { nome: "ID", valor: String(cliente.id) },
                { nome: "VALOR", valor: String(valor) },
                { nome: "QR", valor: String(qrlink.linkVisualizacao) },
              ],
              loc: { id: loc.id },
            }
          : {
              calendario: { expiracao: 43200 },
              devedor: { cnpj: cpf, nome: pppoe },
              valor: { original: valor },
              chave: chave_pix,
              solicitacaoPagador: "Mensalidade",
              infoAdicionais: [
                { nome: "ID", valor: String(cliente.id) },
                { nome: "VALOR", valor: String(valor) },
                { nome: "QR", valor: String(qrlink.linkVisualizacao) },
              ],
              loc: { id: loc.id },
            };

      await efipay.pixCreateCharge(params, body);

      res.status(200).json({
        valor,
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
  }

  async gerarPixAll(req: Request, res: Response): Promise<void> {
    try {
      let { pppoe, cpf } = req.body as { pppoe: string; cpf: string };
      cpf = cpf.replace(/\D/g, "");

      const clientes = await this.recordRepo.find({
        where: { login: pppoe, status: "vencido", datadel: IsNull() },
        order: { datavenc: "ASC" as const },
        take: 3,
      });

      if (!clientes || clientes.length === 0) {
        res
          .status(500)
          .json("Usuário não encontrado ou sem mensalidades vencidas");
        return;
      }

      const efipay = new EfiPay(options);
      const loc = await efipay.pixCreateLocation([], { tipoCob: "cob" });
      const qrlink = await efipay.pixGenerateQRCode({ id: loc.id });

      const structuredData = clientes.map((c) => ({
        valor: Number(c.valor),
        dataVenc: c.datavenc as Date,
        id: c.id,
      }));

      const total = structuredData
        .reduce((s, c) => s + Number(c.valor), 0)
        .toFixed(2);

      const params = { txid: crypto.randomBytes(16).toString("hex") };
      const body: any =
        cpf.length === 11
          ? {
              calendario: { expiracao: 43200 },
              devedor: { cpf, nome: pppoe },
              valor: { original: total },
              chave: chave_pix,
              solicitacaoPagador: "Mensalidade",
              infoAdicionais: [{ nome: "QR", valor: qrlink.linkVisualizacao }],
              loc: { id: loc.id },
            }
          : {
              calendario: { expiracao: 43200 },
              devedor: { cnpj: cpf, nome: pppoe },
              valor: { original: total },
              chave: chave_pix,
              solicitacaoPagador: "Mensalidade",
              infoAdicionais: [{ nome: "QR", valor: qrlink.linkVisualizacao }],
              loc: { id: loc.id },
            };

      structuredData.forEach((c) => {
        body.infoAdicionais.push({ nome: "ID", valor: String(c.id) });
        body.infoAdicionais.push({ nome: "VALOR", valor: String(c.valor) });
      });

      await efipay.pixCreateCharge(params, body);

      res.status(200).json({
        valor: total,
        pppoe,
        link: qrlink.linkVisualizacao,
        structuredData,
      });
      return;
    } catch (error: any) {
      console.error("Erro em gerarPixAll:", error);
      res.status(500).json(error);
      return;
    }
  }

  async gerarPixVariasContas(req: Request, res: Response): Promise<void> {
    try {
      let { nome_completo, cpf } = req.body as {
        nome_completo: string;
        cpf: string;
      };
      const titulos: string[] = String(req.body.titulos || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      nome_completo = String(nome_completo || "").toUpperCase();
      cpf = String(cpf || "").replace(/[^\d]+/g, "");

      const structuredDataRaw = await Promise.all(
        titulos.map(async (idStr) => {
          const id = Number(idStr);
          if (Number.isNaN(id)) return null;
          const fatura = await this.recordRepo.findOne({ where: { id } });
          if (!fatura) return null;
          const login = fatura.login || "";
          const sis = await this.clienteRepo.findOne({ where: { login } });
          const desconto = sis?.desconto ? Number(sis.desconto) : 0;
          return {
            valor: Number(fatura.valor) - desconto,
            dataVenc: fatura.datavenc as Date,
            id: fatura.id,
          };
        })
      );

      const invalidTitulos = structuredDataRaw.some((c) => c === null);
      if (invalidTitulos) {
        res.status(500).json("Um ou mais títulos estão inválidos");
        return;
      }

      let structuredData = structuredDataRaw as {
        valor: number;
        dataVenc: Date;
        id: number;
      }[];

      const efipayLoc = new EfiPay(options);
      const loc = await efipayLoc.pixCreateLocation([], { tipoCob: "cob" });

      const efipayLocLink = new EfiPay(options);
      const qrlink = await efipayLocLink.pixGenerateQRCode({ id: loc.id });
      const link: string = qrlink.linkVisualizacao;

      const resetTime = (d: Date) => {
        const x = new Date(d);
        x.setHours(0, 0, 0, 0);
        return x;
      };
      const differenceInDays = (d1: Date, d2: Date) => {
        const oneDay = 24 * 60 * 60 * 1000;
        return Math.floor(Math.abs((d1.getTime() - d2.getTime()) / oneDay));
      };

      const hoje = new Date();
      structuredData = structuredData.map((c) => {
        const venc = resetTime(new Date(c.dataVenc));
        const h = resetTime(new Date(hoje));
        if (venc < h) {
          c.valor = Number(c.valor.toFixed(2));
          const diffInDays = differenceInDays(hoje, c.dataVenc);
          const monthlyFine = 0.02;
          const dailyFine = 0.00033;
          const multaMensal = c.valor * monthlyFine;
          const multaDiaria = c.valor * Math.max(0, diffInDays - 4) * dailyFine;
          const valorFinal = c.valor + multaMensal + multaDiaria;
          const arredondado = Math.floor(valorFinal * 100) / 100;
          c.valor = Number(arredondado.toFixed(2));
        }
        return c;
      });

      let valorSomadoNum = 0;
      structuredData.forEach((c) => (valorSomadoNum += Number(c.valor)));
      const valorSomado = Number(valorSomadoNum).toFixed(2);

      const efipay = new EfiPay(options);

      const body: any =
        cpf.length === 11
          ? {
              calendario: { expiracao: 43200 },
              devedor: { cpf, nome: nome_completo },
              valor: { original: valorSomado },
              chave: chave_pix,
              solicitacaoPagador: "Mensalidade",
              infoAdicionais: [{ nome: "QR", valor: link }],
              loc: { id: loc.id },
            }
          : {
              calendario: { expiracao: 43200 },
              devedor: { cnpj: cpf, nome: nome_completo },
              valor: { original: valorSomado },
              chave: chave_pix,
              solicitacaoPagador: "Mensalidade",
              infoAdicionais: [{ nome: "QR", valor: link }],
              loc: { id: loc.id },
            };

      structuredData.forEach((c) => {
        body.infoAdicionais.push({ nome: "ID", valor: String(c.id) });
        body.infoAdicionais.push({ nome: "VALOR", valor: String(c.valor) });
      });

      const params = { txid: crypto.randomBytes(16).toString("hex") };
      await efipay.pixCreateCharge(params, body);

      res
        .status(200)
        .json({ valor: valorSomado, nome_completo, link, structuredData });
      return;
    } catch (error: any) {
      console.error("Erro em gerarPixVariasContas:", error);
      res.status(500).json(error);
      return;
    }
  }

  async PixAutomaticoCriar(req: Request, res: Response): Promise<void> {
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

      if(!cpf){
          res.status(500).json('Sem CPF');
          return;
        }

        const cpfLimpo = cpf.replace(/\D/g, "");

        const cliente = await this.recordRepo.findOne({
          where: { login: nome, status: "vencido", datadel: IsNull() },
          order: { datavenc: "ASC" as const },
        });

        if (!cliente) {
          throw new Error(`Usuário ${nome} não encontrado ou sem mensalidades vencidas`);
        }


      const efipay = new EfiPay(options);

      const locResponse = await efipay.pixCreateLocationRecurrenceAutomatic()

      const params = { txid: crypto.randomBytes(16).toString("hex") };
      const cobv = await efipay.pixCreateCharge(params, {calendario: {expiracao: Number(cliente.datavenc)}, chave: String(process.env.CHAVE_PIX), valor, devedor: {
        nome,
        cnpj: cpf,
        cpf: cpf
      }, infoAdicionais: {nome: 'TITULO', valor: cliente.id}})


        

      const documento = cpf.replace(/\D/g, "");

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

      if (!isCPF && !isCNPJ) {
        res.status(400).json({ error: "CPF/CNPJ inválido" });
        return;
      }

      const payload = {
        calendario: { dataInicial: data_inicial, periodicidade },
        politicaRetentativa: politica,
        // ativacao: {dadosJornada: {txid: }},
        loc: 1,
        valor: { valorRec: valor },
        vinculo: {
          contrato,
          devedor: isCPF ? { nome, cpf: documento } : { nome, cnpj: documento },
        },
      };

      const response = await efipay.pixCreateRecurrenceAutomatic("", payload);
      console.log(response);
      

      res.status(200).json(response);
    } catch (error) {
      console.error(error);
      res.status(500).json(error);
    }
  }

  pegarUltimoBoletoGerarPixAutomatico = async (
    req: Request,
    res: Response
  ) => {
    try {

      const efi = new EfiPay(options);
      const hoje = new Date().toISOString().split(".")[0] + "Z";
      const response = await efi.pixListRecurrenceAutomatic({
        inicio: "2025-10-17T00:00:00Z",
        fim: hoje,
        status: 'CRIADA'
      });

      console.log(response);

      

      await Promise.all(
      response.recs.map(async (f) => {

        const cpf = f.vinculo.devedor.cpf ?? f.vinculo.devedor.cnpj;
        const pppoe = f.vinculo.devedor.nome;

        if(!cpf){
          res.status(500).json('Sem CPF');
          return;
        }

        const cpfLimpo = cpf.replace(/\D/g, "");

        const cliente = await this.recordRepo.findOne({
          where: { login: pppoe, status: "vencido", datadel: IsNull() },
          order: { datavenc: "ASC" as const },
        });

        if (!cliente) {
          throw new Error(`Usuário ${pppoe} não encontrado ou sem mensalidades vencidas`);
        }

        console.log(f.calendario.dataInicial);
        console.log(process.env.CONTA);
        
        await efi.pixCreateAutomaticCharge('', {idRec: f.idRec, ajusteDiaUtil: true, calendario: {dataDeVencimento: f.calendario.dataInicial}, recebedor: {agencia:'0001',conta:'600911', tipoConta: 'PAGAMENTO'},
        valor: {original: String(f.valor.valorRec)}, infoAdicional: String(cliente.id)})



      })
    );

      

    } catch (error) {
      console.log(error);
      res.status(500).json(error);
    }
  }

  async listaPixAutomatico(req: Request, res: Response): Promise<void> {
    try {
      const { filtros } = req.body;

      const efi = new EfiPay(options);
      const hoje = new Date().toISOString().split(".")[0] + "Z";

      if (filtros && filtros.status && filtros.status != "TODOS") {
        const response = await efi.pixListRecurrenceAutomatic({
          inicio: "2025-10-17T00:00:00Z",
          status: filtros.status,
          fim: hoje,
          "paginacao.itensPorPagina": 100,
        });
        res.status(200).json(response);
        return;
      }

      const response = await efi.pixListRecurrenceAutomatic({
        inicio: "2025-10-17T00:00:00Z",
        fim: hoje,
        "paginacao.itensPorPagina": 100,
      });
      res.status(200).json(response);
    } catch (error) {
      console.log(error);

      res.status(500).json(error);
    }
  }

  async listarPixAutomaticoUmCliente(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { filtros } = req.body;
      console.log(filtros.idRec);

      const efi = new EfiPay(options);
      const response = await efi.pixDetailRecurrenceAutomatic({
        idRec: filtros.idRec,
      });
      console.log(response);

      res.status(200).json(response);
    } catch (error) {
      res.status(500).json(error);
    }
  }

  async atualizarPixAutomatico(req: Request, res: Response): Promise<void> {
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
  }
}

export default Pix;
