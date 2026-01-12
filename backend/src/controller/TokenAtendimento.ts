import { Request, Response } from "express";
import AppDataSource from "../database/MkauthSource";
import { ClientesEntities } from "../entities/ClientesEntities";
import { Faturas } from "../entities/Faturas";
import { In, IsNull, Or } from "typeorm";
import EfiPay from "sdk-node-apis-efi";
import path from "path";
import dotenv from "dotenv";
import crypto from "crypto";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";

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
    : path.resolve("dist", "files", process.env.CERTIFICATE_PROD!),
  validateMtls: false,
};

const chave_pix = process.env.CHAVE_PIX as string;

const urlPix = isSandbox
  ? "https://pix-h.api.efipay.com.br"
  : "https://pix.api.efipay.com.br";

class TokenAtendimento {
  private recordRepo = AppDataSource.getRepository(Faturas);
  private clienteRepo = AppDataSource.getRepository(ClientesEntities);

  login = async (req: Request, res: Response) => {
    try {
      const cadastros = await this.clienteRepo.find({
        where: { cpf_cnpj: req.body.cpf },
      });
      res.status(200).json(cadastros);
      return;
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Erro ao buscar cliente" });
      return;
    }
  };

  chooseHome = async (req: Request, res: Response) => {
    try {
      const cadastros = await this.clienteRepo.findOne({
        where: { login: req.body.login },
      });
      res.status(200).json(cadastros);
      return;
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Erro ao buscar cliente" });
      return;
    }
  };

  criarCadastro = async (req: Request, res: Response) => {
    try {
      console.log(req.body);

      for (const key in req.body) {
        const valor = req.body[key];
        console.log(valor);

        if (valor === "" || valor === null || valor === undefined) {
          res
            .status(500)
            .json({ error: "Erro ao criar cadastro, campos inválidos" });
          return;
        }
      }

      const cadastro = this.clienteRepo.create(req.body);

      await this.clienteRepo.save(cadastro);
      res.status(200).json({ message: "Cadastro criado com sucesso" });
      return;
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Erro ao criar cadastro" });
      return;
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

  faturaWentPaid = async (req: Request, res: Response) => {
    try {
      let { faturaId } = req.body;

      const fatura = await this.recordRepo.findOne({
        where: { id: faturaId },
      });

      if (!fatura) {
        res.status(404).json({ error: "Fatura nao encontrada" });
        return;
      }

      if (fatura.status != "pago") {
        res.status(400).json({ error: "Fatura ainda nao foi paga" });
        return;
      }

      res.status(200).json({ message: "Fatura paga com sucesso" });
      return;
    } catch (error) {
      res.status(500).json({ error: "Erro Desconhecido" });
      return;
    }
  };

  gerarPixToken = async (req: Request, res: Response) => {
    try {
      let { cpf, login, perdoarJuros } = req.body;

      cpf = cpf.replace(/\D/g, "");

      let pppoe = login;

      const cliente = await this.recordRepo.findOne({
        where: {
          login: pppoe,
          status: In(["vencido", "aberto"]),
          datadel: IsNull(),
        },
        order: { datavenc: "ASC" as const },
      });

      if (!cliente) {
        res.status(404).json({
          error: "Usuário não encontrado ou sem mensalidades vencidas",
        });
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

      if (perdoarJuros) {
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
          imagem: qrlink.imagemQrcode,
          formattedDate,
          faturaId: cliente.id,
        });
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
          imagem: qrlink.imagemQrcode,
          formattedDate,
          faturaId: cliente.id,
        });
      }
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Erro ao gerar Pix" });
    }
  };

  receberPagamentoMercadoPagoWebhook = async (req: Request, res: Response) => {
    try {
      const { body } = req;

      console.log(body);

      const valor = body.data.total_paid_amount;
      const faturaId = body.data.external_reference;

      const status = body.data.status;

      if (status == "processed") {
        const fatura = await this.recordRepo.findOne({
          where: {
            id: Number(faturaId),
          },
        });

        if (!fatura) {
          res.status(404).json({ error: "Fatura nao encontrada" });
          return;
        }

        const faturaUpdate = await this.recordRepo.update(fatura.id, {
          status: "pago",
          datapag: new Date(),
          formapag: "mercadoPagoPoint",
          coletor: "mercadoPagoPoint",
          valorpag: valor,
        });

        console.log(faturaUpdate);

        res.status(200).json({ message: "Pagamento recebido com sucesso" });
        return;
      }
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Erro ao receber pagamento" });
    }
  };

  obterListaTerminaisEGerarPagamento = async (req: Request, res: Response) => {
    try {
      const { login } = req.body;

      const cliente = await this.clienteRepo.findOne({
        where: {
          login,
        },
      });

      if (!cliente) {
        res.status(404).json({ error: "Cliente nao encontrado" });
        return;
      }

      const fatura = await this.recordRepo.findOne({
        where: {
          login: cliente.login,
          status: In(["aberto", "vencido"]),
          datapag: IsNull(),
        },
        order: { datavenc: "ASC" as const },
      });

      if (!fatura) {
        res.status(404).json({ error: "Fatura nao encontrada" });
        return;
      }

      const response = await axios.get(
        "https://api.mercadopago.com/terminals/v1/list",
        {
          headers: {
            Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESSTOKEN}`,
          },
        }
      );

      const terminais = await response.data.data.terminals;

      console.log(terminais);

      const response2 = await axios.post(
        "https://api.mercadopago.com/v1/orders",
        {
          type: "point",
          external_reference: String(fatura.id),
          expiration_time: "PT1M",
          transactions: {
            payments: [
              {
                amount: fatura.valor,
              },
            ],
          },
          config: {
            point: {
              terminal_id: terminais[0].id,
              print_on_terminal: "seller_ticket",
            },
          },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESSTOKEN}`,
            "X-Idempotency-Key": uuidv4(),
          },
        }
      );
      const terminais2 = await response2.data;
      console.log(terminais2.data);
      console.log(response2);

      console.log(terminais2);
      res.status(200).json(terminais2);
    } catch (error: any) {
      console.log("********** ERRO MERCADO PAGO **********");
      console.log(JSON.stringify(error.response?.data, null, 2));
      console.log(JSON.stringify(error.response, null, 2));
      console.log("***************************************");
      console.log(error);
      res.status(500).json({ error: "Erro ao obter lista de terminais" });
    }
  };
}

export default TokenAtendimento;
