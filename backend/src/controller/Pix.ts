import AppDataSource from "../database/API_MK";
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
const logFilePath = path.join(__dirname, '..', "..", "/log", "logPix.json");

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
    ? path.resolve(process.env.CERTIFICATE_SANDBOX!)
    : path.resolve(process.env.CERTIFICATE_PROD!),
  validateMtls: false,
};



const chave_pix = process.env.CHAVE_PIX as string;

class Pix {
  private recordRepo = AppDataSource.getRepository(Faturas);
  private clienteRepo = AppDataSource.getRepository(ClientesEntities);

  constructor() {
    this.AlterarWebhook = this.AlterarWebhook.bind(this);
    this.gerarPix = this.gerarPix.bind(this);
    this.gerarPixAll = this.gerarPixAll.bind(this);
    this.StatusUpdatePixTodosVencidos =
      this.StatusUpdatePixTodosVencidos.bind(this);
    this.gerarPixAberto = this.gerarPixAberto.bind(this);
    this.gerarPixVariasContas = this.gerarPixVariasContas.bind(this);
    this.validarCPF = this.validarCPF.bind(this);
    this.getAccessToken = this.getAccessToken.bind(this);
    this.setPaid = this.setPaid.bind(this);
  }

  AlterarWebhook(url: string, chave: string): void {
    options.validateMtls = false;
    const efipay = new (EfiPay as any)(options);
    efipay
      .pixConfigWebhook({ chave: String(chave) }, { webhookUrl: String(url) })
      .then(console.log)
      .catch(console.log);
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
        error.response ? error.response.data : error.message
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
    res.status(200).end();
    const pixData = req.body.pix;
    if (!pixData || pixData.length === 0) return;

    const { txid } = pixData[0];
    const efipay = new (EfiPay as any)(options);
    let pix: any;

    try {
      pix = await efipay.pixDetailCharge({ txid });
    } catch {
      try {
        pix = await efipay.pixDetailDueCharge({ txid });
      } catch {
        return;
      }
    }

    if (!pix) return;

    const status = pix.status;
    const data = new Date();
    const statusMK = "pago";
    const updates: { idValor: string; valor: string }[] = [];
    let qrCodeLink = "";

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

    if (status === "CONCLUIDA") {
      for (const update of updates) {
        await this.recordRepo.update(update.idValor, {
          status: statusMK,
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

        const moment = require("moment");
        const dataAtual = moment()
          .add(1, "days")
          .format("YYYY-MM-DD HH:mm:ss.SSS");

        if (sis_cliente)
          await this.clienteRepo.update(
            { login: sis_cliente.login },
            { observacao: "sim", rem_obs: dataAtual }
          );

        fs.readFile(logFilePath, "utf8", (err, data) => {
          let logs: any[] = [];
          if (!err) {
            try {
              logs = JSON.parse(data);
              if (!Array.isArray(logs)) logs = [];
            } catch {
              logs = [];
            }
          }
          const log = {
            tipo: "PAGAMENTO CONCLUIDO",
            pppoe: record_pppoe.login,
            status_do_pagamento: status,
            id: update.idValor,
            valor: update.valor,
            timestamp: new Date().toISOString(),
          };
          logs.push(log);
          fs.writeFile(
            logFilePath,
            JSON.stringify(logs, null, 2),
            "utf8",
            () => {}
          );
        });

        const cliente = await this.recordRepo.findOne({
          where: { id: Number(update.idValor), chave_gnet2: Not(IsNull()) },
        });

        if (cliente) {
          const token = await this.getAccessToken();
          if (token) await this.setPaid(token, cliente.chave_gnet2!);
        }
      }
    }
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

  async gerarPixVariasContas(req: Request, res: Response): Promise<void> {
    let { nome_completo, cpf } = req.body as {
      nome_completo: string;
      cpf: string;
      titulos: string;
    };
    const titulos: string[] = String(req.body.titulos || "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    nome_completo = nome_completo.toUpperCase();
    cpf = cpf.replace(/[^\d]+/g, "");

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
      (req as any).flash(
        "errors",
        "Um ou mais títulos estão inválidos ou digitados incorretamente"
      );
      (req as any).session.save(() => res.redirect("back"));
      return;
    }

    let structuredData = structuredDataRaw as {
      valor: number;
      dataVenc: Date;
      id: number;
    }[];

    const efipayLoc = new (EfiPay as any)(options);
    let loc: any;
    try {
      loc = await efipayLoc.pixCreateLocation([], { tipoCob: "cob" });
    } catch (e) {
      (req as any).flash(
        "errors",
        "Falha ao criar localização de cobrança (LOC)"
      );
      (req as any).session.save(() => res.redirect("back"));
      return;
    }

    const locID = loc.id;
    const efipayLocLink = new (EfiPay as any)(options);
    let qrlink: any;
    try {
      qrlink = await efipayLocLink.pixGenerateQRCode({ id: locID });
    } catch (e) {
      (req as any).flash("errors", "Falha ao gerar QR Code");
      (req as any).session.save(() => res.redirect("back"));
      return;
    }
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
      const dataV = new Date(c.dataVenc);
      const venc = resetTime(dataV);
      const h = resetTime(hoje);

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

    const logs = this.lerLogs();
    logs.push({
      tipo: "SOMA DAS MENSALIDADES VARIOS TITULOS",
      cpf,
      nome_completo,
      structuredData,
      timestamp: new Date().toISOString(),
    });
    this.salvarLogs(logs);

    const efipay = new (EfiPay as any)(options);

    const body: any =
      cpf.length === 11
        ? {
            calendario: { expiracao: 43200 },
            devedor: { cpf, nome: nome_completo },
            valor: { original: valorSomado },
            chave: chave_pix,
            solicitacaoPagador: "Mensalidade",
            infoAdicionais: [{ nome: "QR", valor: link }],
            loc: { id: locID },
          }
        : {
            calendario: { expiracao: 43200 },
            devedor: { cnpj: cpf, nome: nome_completo },
            valor: { original: valorSomado },
            chave: chave_pix,
            solicitacaoPagador: "Mensalidade",
            infoAdicionais: [{ nome: "QR", valor: link }],
            loc: { id: locID },
          };

    structuredData.forEach((c) => {
      body.infoAdicionais.push({ nome: "ID", valor: String(c.id) });
      body.infoAdicionais.push({ nome: "VALOR", valor: String(c.valor) });
    });

    const params = { txid: crypto.randomBytes(16).toString("hex") };

    try {
      const pix = await efipay.pixCreateCharge(params, body);
      const pppoe = nome_completo;
      res.render("pix", { valor: valorSomado, pppoe, link, structuredData });
    } catch (error) {
      (req as any).flash("errors", "Falha ao criar cobrança PIX");
      (req as any).session.save(() => res.redirect("back"));
    }
  }

  async gerarPixAberto(req: Request, res: Response): Promise<void> {
    let { pppoe, cpf } = req.body as { pppoe: string; cpf: string };
    cpf = cpf.replace(/\D/g, "");

    const cliente = await this.recordRepo.findOne({
      where: { login: pppoe, status: "aberto", datadel: IsNull() },
      order: { datavenc: "ASC" as const },
    });

    if (!cliente) {
      (req as any).flash(
        "errors",
        "Usuario não encontrado, ou DESATIVADO ou Não tem Mensalidades Vencidas"
      );
      (req as any).session.save(() => res.redirect("back"));
      return;
    }

    const sis_cliente = await this.clienteRepo.findOne({
      where: { login: pppoe, cpf_cnpj: cpf, cli_ativado: "s" },
    });

    if (!sis_cliente) {
      (req as any).flash(
        "errors",
        "Usuario não encontrado, ou DESATIVADO, verifique se digitou corretamente o PPPOE e cpf"
      );
      (req as any).session.save(() => res.redirect("back"));
      return;
    }

    const efipayLoc = new (EfiPay as any)(options);
    let loc: any;
    try {
      loc = await efipayLoc.pixCreateLocation([], { tipoCob: "cob" });
    } catch {
      (req as any).flash(
        "errors",
        "Falha ao criar localização de cobrança (LOC)"
      );
      (req as any).session.save(() => res.redirect("back"));
      return;
    }
    const locID = loc.id;

    const efipayLocLink = new (EfiPay as any)(options);
    let qrlink: any;
    try {
      qrlink = await efipayLocLink.pixGenerateQRCode({ id: locID });
    } catch {
      (req as any).flash("errors", "Falha ao gerar QR Code");
      (req as any).session.save(() => res.redirect("back"));
      return;
    }
    const link: string = qrlink.linkVisualizacao;

    const desconto = Number(sis_cliente.desconto || 0);
    let valorNum = Number(cliente.valor) - desconto;
    const dataVenc = cliente.datavenc as Date;
    const id = cliente.id;

    valorNum = Number(valorNum.toFixed(2));
    let valor = valorNum.toFixed(2);

    const logs = this.lerLogs();
    logs.push({
      tipo: "ULTIMO PIX EM ABERTO",
      cpf,
      pppoe,
      id,
      valor,
      dataVenc,
      timestamp: new Date().toISOString(),
    });
    this.salvarLogs(logs);

    const efipay = new (EfiPay as any)(options);

    const body =
      cpf.length === 11
        ? {
            calendario: { expiracao: 43200 },
            devedor: { cpf, nome: pppoe },
            valor: { original: valor },
            chave: chave_pix,
            solicitacaoPagador: "Mensalidade",
            infoAdicionais: [
              { nome: "ID", valor: String(id) },
              { nome: "VALOR", valor: String(valor) },
              { nome: "QR", valor: String(link) },
            ],
            loc: { id: locID },
          }
        : {
            calendario: { expiracao: 43200 },
            devedor: { cnpj: cpf, nome: pppoe },
            valor: { original: valor },
            chave: chave_pix,
            solicitacaoPagador: "Mensalidade",
            infoAdicionais: [
              { nome: "ID", valor: String(id) },
              { nome: "VALOR", valor: String(valor) },
              { nome: "QR", valor: String(link) },
            ],
            loc: { id: locID },
          };

    const params = { txid: crypto.randomBytes(16).toString("hex") };

    try {
      const pix = await efipay.pixCreateCharge(params, body);
      res.render("pix", { valor, pppoe, link, dataVenc });
    } catch {
      (req as any).flash("errors", "Falha ao criar cobrança PIX");
      (req as any).session.save(() => res.redirect("back"));
    }
  }

  async gerarPix(req: Request, res: Response): Promise<void> {
    let { pppoe, cpf } = req.body as { pppoe: string; cpf: string };
    cpf = cpf.replace(/\D/g, "");

    const cliente = await this.recordRepo.findOne({
      where: { login: pppoe, status: "vencido", datadel: IsNull() },
      order: { datavenc: "ASC" as const },
    });

    if (!cliente) {
      (req as any).flash(
        "errors",
        "Usuario não encontrado ou Não tem Mensalidades Vencidas"
      );
      (req as any).session.save(() => res.redirect("back"));
      return;
    }

    const sis_cliente = await this.clienteRepo.findOne({
      where: { login: pppoe, cpf_cnpj: cpf, cli_ativado: "s" },
    });

    if (!sis_cliente) {
      (req as any).flash(
        "errors",
        "Usuario não encontrado, ou DESATIVADO verifique se digitou corretamente o PPPOE e cpf"
      );
      (req as any).session.save(() => res.redirect("back"));
      return;
    }

    const efipayLoc = new (EfiPay as any)(options);
    let loc: any;
    try {
      loc = await efipayLoc.pixCreateLocation([], { tipoCob: "cob" });
    } catch {
      (req as any).flash(
        "errors",
        "Falha ao criar localização de cobrança (LOC)"
      );
      (req as any).session.save(() => res.redirect("back"));
      return;
    }
    const locID = loc.id;

    const efipayLocLink = new (EfiPay as any)(options);
    let qrlink: any;
    try {
      qrlink = await efipayLocLink.pixGenerateQRCode({ id: locID});
    } catch {
      (req as any).flash("errors", "Falha ao gerar QR Code");
      (req as any).session.save(() => res.redirect("back"));
      return;
    }
    const link: string = qrlink.linkVisualizacao;

    const desconto = Number(sis_cliente.desconto || 0);
    let valorNum = Number(cliente.valor) - desconto;
    const dataVenc = cliente.datavenc as Date;
    const id = cliente.id;

    const hoje = new Date();
    const resetTime = (d: Date) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x;
    };
    const differenceInDays = (d1: Date, d2: Date) => {
      const oneDay = 24 * 60 * 60 * 1000;
      return Math.floor(Math.abs((d1.getTime() - d2.getTime()) / oneDay));
    };

    const v = resetTime(new Date(dataVenc));
    const h = resetTime(new Date(hoje));

    if (v < h) {
      valorNum = Number(valorNum.toFixed(2));
      const diffInDays = differenceInDays(dataVenc, hoje);
      const monthlyFine = 0.02;
      const dailyFine = 0.00033;
      const multaMensal = valorNum * monthlyFine;
      const multaDiaria = valorNum * Math.max(0, diffInDays - 4) * dailyFine;
      const valorFinal = valorNum + multaMensal + multaDiaria;
      const arred = Math.floor(valorFinal * 100) / 100;
      valorNum = Number(arred.toFixed(2));
    }

    let valor =
      typeof valorNum === "string"
        ? Number(valorNum).toFixed(2)
        : valorNum.toFixed(2);

    const logs = this.lerLogs();
    logs.push({
      tipo: "ULTIMO PIX VENCIDO",
      cpf,
      pppoe,
      id,
      valor,
      dataVenc,
      timestamp: new Date().toISOString(),
    });
    this.salvarLogs(logs);

    const efipay = new (EfiPay as any)(options);

    const body =
      cpf.length === 11
        ? {
            calendario: { expiracao: 43200 },
            devedor: { cpf, nome: pppoe },
            valor: { original: valor },
            chave: chave_pix,
            solicitacaoPagador: "Mensalidade",
            infoAdicionais: [
              { nome: "ID", valor: String(id) },
              { nome: "VALOR", valor: String(valor) },
              { nome: "QR", valor: String(link) },
            ],
            loc: { id: locID },
          }
        : {
            calendario: { expiracao: 43200 },
            devedor: { cnpj: cpf, nome: pppoe },
            valor: { original: valor },
            chave: chave_pix,
            solicitacaoPagador: "Mensalidade",
            infoAdicionais: [
              { nome: "ID", valor: String(id) },
              { nome: "VALOR", valor: String(valor) },
              { nome: "QR", valor: String(link) },
            ],
            loc: { id: locID },
          };

    const params = { txid: crypto.randomBytes(16).toString("hex") };

    try {
      const pix = await efipay.pixCreateCharge(params, body);
      const options2 = {
        month: "2-digit",
        day: "2-digit",
      } as Intl.DateTimeFormatOptions;
      const formattedDate = new Intl.DateTimeFormat("pt-BR", options2).format(
        dataVenc
      );
      res.render("pix", { valor, pppoe, link, formattedDate });
    } catch {
      (req as any).flash("errors", "Falha ao criar cobrança PIX");
      (req as any).session.save(() => res.redirect("back"));
    }
  }

  async gerarPixAll(req: Request, res: Response): Promise<void> {
    let { pppoe, cpf } = req.body as { pppoe: string; cpf: string };
    cpf = cpf.replace(/\D/g, "");

    const cliente = await this.recordRepo.find({
      where: { login: pppoe, status: "vencido", datadel: IsNull() },
      order: { datavenc: "ASC" as const },
      take: 3,
    });

    if (!cliente || cliente.length === 0) {
      (req as any).flash(
        "errors",
        "Usuario não encontrado ou Não tem Mensalidades Vencidas"
      );
      (req as any).session.save(() => res.redirect("back"));
      return;
    }

    const sis_cliente = await this.clienteRepo.findOne({
      where: { login: pppoe, cpf_cnpj: cpf, cli_ativado: "s" },
    });

    if (!sis_cliente) {
      (req as any).flash(
        "errors",
        "Usuario não encontrado, ou está Desativado, verifique se digitou corretamente o PPPOE e cpf"
      );
      (req as any).session.save(() => res.redirect("back"));
      return;
    }

    const efipayLoc = new (EfiPay as any)(options);
    let loc: any;
    try {
      loc = await efipayLoc.pixCreateLocation([], { tipoCob: "cob" });
    } catch {
      (req as any).flash(
        "errors",
        "Falha ao criar localização de cobrança (LOC)"
      );
      (req as any).session.save(() => res.redirect("back"));
      return;
    }
    const locID = loc.id;

    const efipayLocLink = new (EfiPay as any)(options);
    let qrlink: any;
    try {
      qrlink = await efipayLocLink.pixGenerateQRCode({ id: locID });
    } catch {
      (req as any).flash("errors", "Falha ao gerar QR Code");
      (req as any).session.save(() => res.redirect("back"));
      return;
    }
    const link: string = qrlink.linkVisualizacao;

    const desconto = Number(sis_cliente.desconto || 0);

    const resetTime = (d: Date) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x;
    };
    const differenceInDays = (d1: Date, d2: Date) => {
      const oneDay = 24 * 60 * 60 * 1000;
      return Math.floor(Math.abs((d1.getTime() - d2.getTime()) / oneDay));
    };

    let structuredData = cliente.map((c) => ({
      valor: Number(c.valor),
      dataVenc: c.datavenc as Date,
      id: c.id,
    }));

    const hoje = new Date();

    structuredData = structuredData.map((c, index) => {
      const dataV = new Date(c.dataVenc);

      if (index === 2) {
        c.valor = Math.floor(c.valor * 0.5);
      }

      const venc = resetTime(new Date(dataV));
      const h = resetTime(new Date(hoje));

      if (venc < h) {
        c.valor -= desconto;
        c.valor = Number(c.valor.toFixed(2));

        const diffInDays = differenceInDays(hoje, c.dataVenc);
        const monthlyFine = 0.02;
        const dailyFine = 0.00033;

        const multaMensal = c.valor * monthlyFine;
        const multaDiaria = c.valor * Math.max(0, diffInDays - 4) * dailyFine;
        const valorFinal = c.valor + multaMensal + multaDiaria;
        const arred = Math.floor(valorFinal * 100) / 100;
        c.valor = Number(arred.toFixed(2));
      }

      return c;
    });

    let valorSomadoNum = 0;
    structuredData.forEach((c) => (valorSomadoNum += Number(c.valor)));
    const valorSomado = Number(valorSomadoNum).toFixed(2);

    const logs = this.lerLogs();
    logs.push({
      tipo: "SOMA DAS MENSALIDADES VENCIDAS!",
      cpf,
      pppoe,
      structuredData,
      timestamp: new Date().toISOString(),
    });
    this.salvarLogs(logs);

    const efipay = new (EfiPay as any)(options);

    const body: any =
      cpf.length === 11
        ? {
            calendario: { expiracao: 43200 },
            devedor: { cpf, nome: pppoe },
            valor: { original: valorSomado },
            chave: chave_pix,
            solicitacaoPagador: "Mensalidade",
            infoAdicionais: [{ nome: "QR", valor: link }],
            loc: { id: locID },
          }
        : {
            calendario: { expiracao: 43200 },
            devedor: { cnpj: cpf, nome: pppoe },
            valor: { original: valorSomado },
            chave: chave_pix,
            solicitacaoPagador: "Mensalidade",
            infoAdicionais: [{ nome: "QR", valor: link }],
            loc: { id: locID },
          };

    structuredData.forEach((c) => {
      body.infoAdicionais.push({ nome: "ID", valor: String(c.id) });
      body.infoAdicionais.push({ nome: "VALOR", valor: String(c.valor) });
    });

    const params = { txid: crypto.randomBytes(16).toString("hex") };

    try {
      const pix = await efipay.pixCreateCharge(params, body);
      const valor = valorSomado;
      res.render("pix", { valor, pppoe, link, structuredData });
    } catch {
      (req as any).flash("errors", "Falha ao criar cobrança PIX");
      (req as any).session.save(() => res.redirect("back"));
    }
  }

  // ----------------------- Funções Auxiliares -----------------------
private lerLogs(): any[] {
  try {
    const data = fs.readFileSync(logFilePath, 'utf8'); // Lê o arquivo log.json
    const logs = JSON.parse(data); // Converte para array
    return Array.isArray(logs) ? logs : []; // Garante que é um array
  } catch {
    return []; // Caso o arquivo não exista ou esteja vazio
  }
}

private salvarLogs(logs: any[]): void {
  fs.writeFileSync(logFilePath, JSON.stringify(logs, null, 2), 'utf8'); // Salva o conteúdo formatado
}


}

export default Pix;
