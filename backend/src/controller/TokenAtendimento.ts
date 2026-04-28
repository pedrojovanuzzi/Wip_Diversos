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
import moment from "moment";

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

  private static lastOrderByTerminal: Map<string, string> = new Map();

  private cancelarOrderMP = async (
    orderId: string,
  ): Promise<{ ok: boolean; reason?: string }> => {
    try {
      await axios.post(
        `https://api.mercadopago.com/v1/orders/${orderId}/cancel`,
        {},
        {
          headers: {
            Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESSTOKEN}`,
            "X-Idempotency-Key": uuidv4(),
          },
        },
      );
      return { ok: true };
    } catch (err: any) {
      const errors: any[] = err.response?.data?.errors || [];
      const code = errors[0]?.code;
      console.log(
        `[MP] Falha ao cancelar order ${orderId}:`,
        err.response?.data || err.message,
      );
      return { ok: false, reason: code };
    }
  };

  private buscarOrderPendenteNoTerminal = async (
    terminalId: string,
  ): Promise<string | null> => {
    try {
      const r = await axios.get(
        `https://api.mercadopago.com/v1/orders/search`,
        {
          params: { terminal_id: terminalId },
          headers: {
            Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESSTOKEN}`,
          },
        },
      );
      const results: any[] =
        r.data?.results || r.data?.elements || r.data?.data || [];
      const pendente = results.find((o) =>
        ["created", "processing", "at_terminal", "action_required"].includes(
          String(o.status || "").toLowerCase(),
        ),
      );
      return pendente?.id ? String(pendente.id) : null;
    } catch (err: any) {
      console.log(
        "[MP] Falha ao buscar orders do terminal:",
        err.response?.data || err.message,
      );
      return null;
    }
  };

  private criarOrderMPNoTerminal = async (
    terminalId: string,
    payload: any,
  ): Promise<{ ok: true; response: any } | { ok: false; reason: string }> => {
    const post = () =>
      axios.post("https://api.mercadopago.com/v1/orders", payload, {
        headers: {
          Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESSTOKEN}`,
          "X-Idempotency-Key": uuidv4(),
        },
      });

    try {
      const resp = await post();
      if (resp.data?.id) {
        TokenAtendimento.lastOrderByTerminal.set(terminalId, String(resp.data.id));
      }
      return { ok: true, response: resp };
    } catch (error: any) {
      const errors: any[] = error.response?.data?.errors || [];
      const isQueued = errors.some(
        (e) => e.code === "already_queued_order_on_terminal",
      );
      if (!isQueued) throw error;

      console.log(
        `[MP] Terminal ${terminalId} ocupado — tentando liberar e recriar order`,
      );

      const cached = TokenAtendimento.lastOrderByTerminal.get(terminalId);
      let cancelado = false;
      if (cached) {
        const r = await this.cancelarOrderMP(cached);
        cancelado = cancelado || r.ok;
      }

      const found = await this.buscarOrderPendenteNoTerminal(terminalId);
      if (found && found !== cached) {
        const r = await this.cancelarOrderMP(found);
        cancelado = cancelado || r.ok;
      }

      if (!cancelado) {
        return { ok: false, reason: "terminal_busy" };
      }

      TokenAtendimento.lastOrderByTerminal.delete(terminalId);

      try {
        const retry = await post();
        if (retry.data?.id) {
          TokenAtendimento.lastOrderByTerminal.set(
            terminalId,
            String(retry.data.id),
          );
        }
        return { ok: true, response: retry };
      } catch (retryErr: any) {
        const retryErrors: any[] = retryErr.response?.data?.errors || [];
        const stillQueued = retryErrors.some(
          (e) => e.code === "already_queued_order_on_terminal",
        );
        if (stillQueued) return { ok: false, reason: "terminal_busy" };
        throw retryErr;
      }
    }
  };

  login = async (req: Request, res: Response) => {
    try {
      const cadastros = await this.clienteRepo.find({
        where: { cpf_cnpj: req.body.cpf, cli_ativado: "s" },
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
        where: { login: req.body.login, cli_ativado: "s" },
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

      const addClient = await this.clienteRepo.save({
        nome: (req.body.nome || "").toUpperCase(),
        login: (req.body.nome || "").trim().replace(/\s/g, "").toUpperCase(),
        rg: req.body.rg.trim().replace(/\s/g, ""),
        cpf_cnpj: req.body.cpf_cnpj.trim().replace(/\s/g, ""),
        uuid_cliente: `019b${uuidv4().slice(0, 32)}`,
        email: req.body.email.trim().replace(/\s/g, ""),
        cidade: `${req.body.cidade
          .trim()
          .slice(0, 1)
          .toUpperCase()}${req.body.cidade.trim().slice(1)}`,
        bairro: req.body.bairro.toUpperCase().trim(),
        estado: (req.body.estado || "")
          .toUpperCase()
          .replace(/\s/g, "")
          .slice(0, 2),
        nascimento: req.body.nascimento.replace(
          /(\d{2})\/(\d{2})\/(\d{4})/,
          "$3-$2-$1",
        ),
        numero: req.body.numero.trim().replace(/\s/g, ""),
        endereco: req.body.endereco.toUpperCase().trim(),
        cep: `${req.body.cep
          .trim()
          .replace(/\s/g, "")
          .slice(0, 5)}-${req.body.cep.trim().replace(/\s/g, "").slice(5)}`,
        plano: req.body.plano,
        fone: "(14)3296-1608",
        venc: (req.body.vencimento || "")
          .trim()
          .replace(/\s/g, "")
          .replace(/\D/g, ""),
        celular: `(${req.body.celular.slice(0, 2)})${req.body.celular.slice(
          2,
        )}`,
        celular2: `(${req.body.celularSecundario.slice(
          0,
          2,
        )})${req.body.celularSecundario.slice(2)}`,
        estado_res: (req.body.estado || "")
          .toUpperCase()
          .replace(/\s/g, "")
          .slice(0, 2),
        bairro_res: req.body.bairro.toUpperCase().trim(),
        cidade_res: `${req.body.cidade
          .trim()
          .slice(0, 1)
          .toUpperCase()}${req.body.cidade.trim().slice(1)}`,
        cep_res: `${req.body.cep
          .trim()
          .replace(/\s/g, "")
          .slice(0, 5)}-${req.body.cep.trim().replace(/\s/g, "").slice(5)}`,
        numero_res: req.body.numero.trim().replace(/\s/g, ""),
        endereco_res: req.body.endereco.toUpperCase().trim(),
        tipo_cob: "titulo",
        mesref: "now",
        prilanc: "tot",
        pessoa:
          req.body.cpf_cnpj.replace(/\D/g, "").length <= 11
            ? "fisica"
            : "juridica",
        dias_corte: 80,
        cadastro: moment().format("DD-MM-YYYY").split("-").join("/"),
        data_ip: moment().format("YYYY-MM-DD HH:mm:ss"),
        data_ins: moment().format("YYYY-MM-DD HH:mm:ss"),
      });
      await this.clienteRepo.update(addClient.id, {
        termo: `${addClient.id}C/${moment().format("YYYY")}`,
      });
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

  faturaWentPaid = async (req: Request, res: Response) => {
    try {
      let { faturaId } = req.body;

      const ids = String(faturaId).split(/[,-]/);

      const faturas = await this.recordRepo.find({
        where: { id: In(ids.map((id) => Number(id))) },
      });

      if (!faturas || faturas.length === 0) {
        res.status(404).json({ error: "Faturas nao encontradas" });
        return;
      }

      console.log(faturas);

      const allPaid = faturas.every((f) => f.status === "pago");

      if (!allPaid) {
        res.status(400).json({ error: "Alguma fatura ainda nao foi paga" });
        return;
      }

      res.status(200).json({ pago: true });
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
        dataVenc,
      );

      const valorFinal = Number(valorDesconto).toFixed(2);

      if (perdoarJuros) {
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

        // const options2 = {
        //   month: "2-digit",
        //   day: "2-digit",
        // } as Intl.DateTimeFormatOptions;
        // const formattedDate = new Intl.DateTimeFormat("pt-BR", options2).format(
        //   cliente.datavenc as Date
        // );

        const formattedDate = cliente.datavenc;

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

        const formattedDate = cliente.datavenc;

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
        const ids = String(faturaId).split(/[,-]/);

        for (const id of ids) {
          const fatura = await this.recordRepo.findOne({
            where: {
              id: Number(id),
            },
          });

          if (fatura) {
            await this.recordRepo.update(fatura.id, {
              status: "pago",
              datapag: new Date(),
              formapag: "mercadoPagoPoint",
              coletor: "mercadoPagoPoint",
              valorpag: fatura.valor, // Note: We might want the calculated value, but here we just mark as paid. Ideally we usually use the 'total_paid_amount' distributed? For now, setting 'valor' is consistent with "paid full".
              // Better: if multiple, total_paid_amount is sum. We can't easily know specific amount for each if it was bundled.
              // Assuming full payment of the invoice value.
            });
            console.log(`Fatura ${id} confirmada paga via MercadoPago.`);

            const cliente = await this.clienteRepo.findOne({
              where: {
                login: fatura.login,
              },
            });

            if (!cliente) {
              console.log(`Cliente ${fatura.login} nao encontrado.`);
              continue;
            }

            if (cliente) {
              const remObsDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
                .toISOString()
                .replace("T", " ")
                .replace("Z", "");
              await this.clienteRepo.update(
                { login: cliente.login },
                { observacao: "sim", rem_obs: remObsDate },
              );
            }
          }
        }

        res.status(200).json({ message: "Pagamento recebido com sucesso" });
        return;
      }
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Erro ao receber pagamento" });
    }
  };

  obterListaTerminaisEGerarPagamentoCredito = async (
    req: Request,
    res: Response,
  ) => {
    try {
      const { login } = req.body;

      const cliente = await this.clienteRepo.findOne({
        where: {
          login,
          cli_ativado: "s",
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
          datadel: IsNull(),
        },
        order: { datavenc: "ASC" as const },
      });

      if (!fatura) {
        res.status(404).json({ error: "Fatura nao encontrada" });
        return;
      }

      const valor = await this.aplicarJuros_Desconto(
        fatura.valor,
        cliente.login,
        fatura.datavenc,
      );

      const response = await axios.get(
        "https://api.mercadopago.com/terminals/v1/list",
        {
          headers: {
            Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESSTOKEN}`,
          },
        },
      );

      const terminais = await response.data.data.terminals;

      console.log(terminais);

      const result = await this.criarOrderMPNoTerminal(terminais[0].id, {
        type: "point",
        external_reference: String(fatura.id),
        expiration_time: "PT1M",
        transactions: {
          payments: [
            {
              amount: String(valor),
            },
          ],
        },
        config: {
          point: {
            terminal_id: terminais[0].id,
            print_on_terminal: "seller_ticket",
          },
          payment_method: {
            default_type: "credit_card",
            installments_cost: "buyer",
            default_installments: 1,
          },
        },
      });

      if (!result.ok) {
        res.status(200).json({ terminalBusy: true, reason: result.reason });
        return;
      }

      const terminais2 = result.response.data;
      res.status(200).json({
        id: fatura.id,
        valor: valor,
        order: terminais2,
        dataPagamento: fatura.datavenc,
      });
    } catch (error: any) {
      console.log("********** ERRO MERCADO PAGO **********");
      console.log(JSON.stringify(error.response?.data, null, 2));
      console.log(JSON.stringify(error.response, null, 2));
      console.log("***************************************");
      console.log(error);
      res.status(500).json({ error: "Erro ao obter lista de terminais" });
    }
  };

  obterListaTerminaisEGerarPagamentoDebito = async (
    req: Request,
    res: Response,
  ) => {
    try {
      const { login } = req.body;

      const cliente = await this.clienteRepo.findOne({
        where: {
          login,
          cli_ativado: "s",
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
          datadel: IsNull(),
        },
        order: { datavenc: "ASC" as const },
      });

      if (!fatura) {
        res.status(404).json({ error: "Fatura nao encontrada" });
        return;
      }

      const valor = await this.aplicarJuros_Desconto(
        fatura.valor,
        cliente.login,
        fatura.datavenc,
      );

      const response = await axios.get(
        "https://api.mercadopago.com/terminals/v1/list",
        {
          headers: {
            Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESSTOKEN}`,
          },
        },
      );

      const terminais = await response.data.data.terminals;

      console.log(terminais);

      const result = await this.criarOrderMPNoTerminal(terminais[0].id, {
        type: "point",
        external_reference: String(fatura.id),
        expiration_time: "PT1M",
        transactions: {
          payments: [
            {
              amount: String(valor),
            },
          ],
        },
        config: {
          point: {
            terminal_id: terminais[0].id,
            print_on_terminal: "seller_ticket",
          },
          payment_method: {
            default_type: "debit_card",
          },
        },
      });

      if (!result.ok) {
        res.status(200).json({ terminalBusy: true, reason: result.reason });
        return;
      }

      const terminais2 = result.response.data;
      res.status(200).json({
        id: fatura.id,
        valor: valor,
        order: terminais2,
        dataPagamento: fatura.datavenc,
      });
    } catch (error: any) {
      console.log("********** ERRO MERCADO PAGO **********");
      console.log(JSON.stringify(error.response?.data, null, 2));
      console.log(JSON.stringify(error.response, null, 2));
      console.log("***************************************");
      console.log(error);
      res.status(500).json({ error: "Erro ao obter lista de terminais" });
    }
  };

  cancelarOrder = async (req: Request, res: Response) => {
    try {
      const { order } = req.params;
      if (!order) {
        res.status(400).json({ error: "Order ID não informado" });
        return;
      }

      const result = await this.cancelarOrderMP(String(order));

      if (result.ok) {
        for (const [terminalId, id] of TokenAtendimento.lastOrderByTerminal) {
          if (id === String(order)) {
            TokenAtendimento.lastOrderByTerminal.delete(terminalId);
          }
        }
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.log("[MP] Erro ao cancelar order:", error.response?.data || error);
      res.status(500).json({ error: "Erro ao cancelar order" });
    }
  };

  obterOrderPorId = async (req: Request, res: Response) => {
    try {
      const { order } = req.params;

      const response = await axios.get(
        `https://api.mercadopago.com/v1/orders/${order}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESSTOKEN}`,
          },
        },
      );

      if (!response) {
        res.status(404).json({ error: "Order nao encontrado" });
        return;
      }

      console.log(response.data);

      res.status(200).json(response.data);
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: error });
    }
  };
  listarFaturasAbertas = async (req: Request, res: Response) => {
    try {
      const { login } = req.body;

      if (!login) {
        res.status(400).json({ error: "Login não informado" });
        return;
      }

      const sis_cliente = await this.clienteRepo.findOne({
        where: { login: login, cli_ativado: "s" },
      });

      if (!sis_cliente) {
        res.status(404).json({ error: "Cliente nao encontrado" });
        return;
      }

      const faturas = await this.recordRepo.find({
        where: {
          login: sis_cliente.login,
          status: In(["aberto", "vencido"]),
          datadel: IsNull(),
        },
        order: { datavenc: "ASC" as const },
      });

      const faturasProcessadas = await Promise.all(
        faturas.map(async (fatura) => {
          const valorCorrigido = await this.aplicarJuros_Desconto(
            fatura.valor,
            sis_cliente.login,
            fatura.datavenc,
          );

          return {
            id: fatura.id,
            valor: valorCorrigido.toFixed(2),
            data_vencimento: fatura.datavenc,
            descricao: fatura.referencia || fatura.obs || `Fatura ${fatura.id}`,
            status: fatura.status,
          };
        }),
      );

      res.status(200).json(faturasProcessadas);
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Erro ao listar faturas" });
    }
  };

  gerarPixVariasContas = async (req: Request, res: Response): Promise<void> => {
    try {
      // 🔹 Extrai os dados principais do corpo da requisição
      let { nome_completo, cpf } = req.body as {
        nome_completo: string;
        cpf: string;
      };

      // 🔹 Extrai os IDs dos títulos
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
        body.infoAdicionais.push({
          nome: "VALOR",
          valor: c.valor.toFixed(2),
        });
      });

      // 🔹 Cria a cobrança PIX somando todos os títulos
      const params = { txid: crypto.randomBytes(16).toString("hex") };

      console.log("********** PAYLOAD PIX MULTIPLO **********");
      console.log(JSON.stringify(body, null, 2));
      console.log("******************************************");

      try {
        await efipay.pixCreateCharge(params, body);
      } catch (error: any) {
        console.error("********** ERRO EFIPAY CREATE CHARGE **********");
        console.error(JSON.stringify(error.response?.data || error, null, 2));
        console.error(JSON.stringify(error.response, null, 2));
        console.error("***********************************************");
        throw error; // Re-throw to be caught by outer catch
      }

      // 🔹 Retorna o resultado ao frontend
      res.status(200).json({
        valor: valorSomado,
        nome_completo,
        link: qrlink.linkVisualizacao,
        qrcode: qrlink.qrcode, // Add EMV payload for frontend generation
        titulos: structuredData,
        faturaId: structuredData.map((d) => d.id).join(","), // Return all IDs for polling
      });
    } catch (error: any) {
      console.error("❌ Erro em gerarPixVariasContas:", error);
      res.status(500).json({ erro: error.message || error });
    }
  };

  gerarPagamentoMultiploCredito = async (req: Request, res: Response) => {
    try {
      const titulos: string[] = String(req.body.titulos || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      if (titulos.length === 0) {
        res.status(400).json({ error: "Nenhum título informado" });
        return;
      }

      const faturas = await this.recordRepo.find({
        where: { id: In(titulos.map(Number)) },
      });

      if (!faturas.length) {
        res.status(404).json({ error: "Faturas não encontradas" });
        return;
      }

      let total = 0;
      for (const fatura of faturas) {
        const valorCalc = await this.aplicarJuros_Desconto(
          fatura.valor,
          fatura.login,
          fatura.datavenc,
        );
        total += valorCalc;
      }

      // MercadoPago Logic
      const response = await axios.get(
        "https://api.mercadopago.com/terminals/v1/list",
        {
          headers: {
            Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESSTOKEN}`,
          },
        },
      );

      const terminais = response.data.data.terminals;
      if (!terminais.length) {
        res.status(500).json({ error: "Nenhum terminal disponível" });
        return;
      }

      const externalRef = titulos.join("-"); // "101-102-103"

      const result = await this.criarOrderMPNoTerminal(terminais[0].id, {
        type: "point",
        external_reference: externalRef,
        expiration_time: "PT1M",
        transactions: {
          payments: [
            {
              amount: total.toFixed(2),
            },
          ],
        },
        config: {
          point: {
            terminal_id: terminais[0].id,
            print_on_terminal: "seller_ticket",
          },
          payment_method: {
            default_type: "credit_card",
            installments_cost: "buyer",
            default_installments: 1,
          },
        },
      });

      if (!result.ok) {
        res.status(200).json({
          terminalBusy: true,
          reason: result.reason,
          valor: total.toFixed(2),
        });
        return;
      }

      res.status(200).json({
        id: externalRef,
        order: result.response.data,
        valor: total.toFixed(2),
        dataPagamento: new Date(),
      });
    } catch (error: any) {
      console.log("********** ERRO MERCADO PAGO **********");
      console.log(JSON.stringify(error.response?.data, null, 2));
      console.log(JSON.stringify(error.response, null, 2));
      console.log("***************************************");
      console.error(error);
      res.status(500).json({ error: "Erro ao gerar pagamento múltiplo" });
    }
  };

  gerarPagamentoMultiploDebito = async (req: Request, res: Response) => {
    try {
      const titulos: string[] = String(req.body.titulos || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      if (titulos.length === 0) {
        res.status(400).json({ error: "Nenhum título informado" });
        return;
      }

      const faturas = await this.recordRepo.find({
        where: { id: In(titulos.map(Number)) },
      });

      if (!faturas.length) {
        res.status(404).json({ error: "Faturas não encontradas" });
        return;
      }

      let total = 0;
      for (const fatura of faturas) {
        const valorCalc = await this.aplicarJuros_Desconto(
          fatura.valor,
          fatura.login,
          fatura.datavenc,
        );
        total += valorCalc;
      }

      // MercadoPago Logic
      const response = await axios.get(
        "https://api.mercadopago.com/terminals/v1/list",
        {
          headers: {
            Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESSTOKEN}`,
          },
        },
      );

      const terminais = response.data.data.terminals;
      if (!terminais.length) {
        res.status(500).json({ error: "Nenhum terminal disponível" });
        return;
      }

      const externalRef = titulos.join("-");

      const result = await this.criarOrderMPNoTerminal(terminais[0].id, {
        type: "point",
        external_reference: externalRef,
        expiration_time: "PT1M",
        transactions: {
          payments: [
            {
              amount: total.toFixed(2),
            },
          ],
        },
        config: {
          point: {
            terminal_id: terminais[0].id,
            print_on_terminal: "seller_ticket",
          },
          payment_method: {
            default_type: "debit_card",
          },
        },
      });

      if (!result.ok) {
        res.status(200).json({
          terminalBusy: true,
          reason: result.reason,
          valor: total.toFixed(2),
        });
        return;
      }

      res.status(200).json({
        id: externalRef,
        order: result.response.data,
        valor: total.toFixed(2),
        dataPagamento: new Date(),
      });
    } catch (error: any) {
      console.log("********** ERRO MERCADO PAGO **********");
      console.log(JSON.stringify(error.response?.data, null, 2));
      console.log(JSON.stringify(error.response, null, 2));
      console.log("***************************************");
      console.error(error);
      res.status(500).json({ error: "Erro ao gerar pagamento múltiplo" });
    }
  };
}

export default TokenAtendimento;
