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

// =========================================================
// PayGo / ControlPay (TEF de cartão)
// =========================================================
const PAYGO_BASE = "https://api.controlpay.com.br";

// O token é guardado já URL-encoded no .env, então entra direto na URL.
const PAYGO_TOKEN = process.env.PAYGO_TOKEN || "";
const PAYGO_TERMINAL_ID = process.env.PAYGO_TERMINAL_ID || "";
const PAYGO_FORMA_CREDITO = process.env.PAYGO_FORMA_CREDITO || "21";
const PAYGO_FORMA_DEBITO = process.env.PAYGO_FORMA_DEBITO || "22";
const PAYGO_CANCEL_PASS = process.env.PAYGO_CANCEL_PASS || "";

const paygoUrl = (endpoint: string) =>
  `${PAYGO_BASE}/${endpoint}?key=${PAYGO_TOKEN}`;

const PAYGO_HEADERS = {
  "Content-Type": "application/json",
  "User-Agent": "WipTotem/1.0",
};

// IDs de status da intenção de venda no ControlPay.
const PAYGO_STATUS = {
  PENDENTE: 5,
  EM_PAGAMENTO: 6,
  CREDITADO: 10,
  EXPIRADO: 15,
  CANCELADO: 20,
  RECUSADO: 25,
};

class TokenAtendimento {
  private recordRepo = AppDataSource.getRepository(Faturas);
  private clienteRepo = AppDataSource.getRepository(ClientesEntities);

  // Mapeia a intenção de venda da PayGo -> faturas (id + valor exato cobrado),
  // para confirmar o pagamento e gravar o valor real quando creditada.
  private static faturasPorVenda: Map<
    string,
    { id: string; valor: number }[]
  > = new Map();

  private extrairStatusIntencao = (intencao: any): number | null => {
    const s =
      intencao?.intencaoVendaStatus?.id ??
      intencao?.status?.id ??
      intencao?.status ??
      intencao?.statusId;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  // Distingue uma recusa real da adquirente (cartão negado) de um simples
  // cancelamento/tempo esgotado. Numa recusa real o cartão foi processado,
  // então o pagamentoExterno traz dados da adquirente; num cancelamento/tempo
  // nada foi processado e esses campos vêm vazios.
  private foiRecusaReal = (intencao: any): boolean => {
    const pagamentos: any[] = intencao?.pagamentosExternos || [];
    const naoVazio = (v: any) => v != null && String(v).trim() !== "";
    return pagamentos.some(
      (p) =>
        naoVazio(p?.codigoRespostaAdquirente) ||
        naoVazio(p?.mensagemRespostaAdquirente) ||
        naoVazio(p?.nsuTid) ||
        naoVazio(p?.trnNsu) ||
        naoVazio(p?.adquirente) ||
        naoVazio(p?.bandeira),
    );
  };

  private getIntencaoVendaPayGo = async (
    intencaoVendaId: string,
  ): Promise<any | null> => {
    try {
      const r = await axios.post(
        paygoUrl("IntencaoVenda/GetById"),
        {},
        { headers: PAYGO_HEADERS, params: { intencaoVendaId } },
      );
      return r.data?.intencaoVenda || r.data || null;
    } catch (err: any) {
      console.log(
        "[PayGo] Falha ao consultar intenção de venda:",
        err.response?.data || err.message,
      );
      return null;
    }
  };

  private marcarFaturasPagas = async (
    itens: { id: string | number; valor?: number }[],
  ): Promise<void> => {
    for (const item of itens) {
      const id = Number(String(item.id).trim());
      if (!Number.isFinite(id) || id <= 0) continue;

      const fatura = await this.recordRepo.findOne({ where: { id } });
      if (!fatura) {
        console.log(`[PayGo] Fatura ${id} não encontrada.`);
        continue;
      }
      if (fatura.status === "pago") continue;

      // Usa o valor exato cobrado no cartão (guardado ao criar a venda). Só
      // recalcula com juros/desconto como fallback — ex.: confirmação após
      // reinício do servidor, quando o mapa em memória foi perdido.
      const valorPago =
        item.valor != null
          ? item.valor
          : await this.aplicarJuros_Desconto(
              fatura.valor,
              fatura.login,
              fatura.datavenc,
            );

      await this.recordRepo.update(fatura.id, {
        status: "pago",
        datapag: new Date(),
        formapag: "payGoTef",
        coletor: "payGoTef",
        valorpag: valorPago.toFixed(2),
      });
      console.log(`[PayGo] Fatura ${id} confirmada paga via PayGo TEF.`);

      const cliente = await this.clienteRepo.findOne({
        where: { login: fatura.login },
      });
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
  };

  private criarVendaPayGo = async (opts: {
    faturas: { id: string | number; valor: number }[];
    tipo: "credito" | "debito";
  }): Promise<
    { ok: true; intencaoVendaId: string } | { ok: false; reason: string }
  > => {
    const referencia = opts.faturas.map((f) => String(f.id)).join("-");
    const valorTotal = opts.faturas.reduce((acc, f) => acc + f.valor, 0);

    const body = {
      formaPagamentoId: Number(
        opts.tipo === "credito" ? PAYGO_FORMA_CREDITO : PAYGO_FORMA_DEBITO,
      ),
      terminalId: PAYGO_TERMINAL_ID,
      valorTotalVendido: valorTotal.toFixed(2).replace(".", ","),
      quantidadeParcelas: 1,
      parcelamentoAdmin: opts.tipo === "credito",
      iniciarTransacaoAutomaticamente: true,
      aguardarTefIniciarTransacao: true,
      referencia,
      observacao: "Totem autoatendimento",
    };

    try {
      const r = await axios.post(paygoUrl("Venda/Vender/"), body, {
        headers: PAYGO_HEADERS,
      });
      const intencao = r.data?.intencaoVenda || r.data;
      const intencaoVendaId = intencao?.id ? String(intencao.id) : null;

      if (!intencaoVendaId) {
        return { ok: false, reason: "terminal_offline" };
      }

      TokenAtendimento.faturasPorVenda.set(
        intencaoVendaId,
        opts.faturas.map((f) => ({ id: String(f.id), valor: f.valor })),
      );
      return { ok: true, intencaoVendaId };
    } catch (err: any) {
      console.log(
        "[PayGo] Falha ao criar venda:",
        err.response?.data || err.message,
      );
      return { ok: false, reason: "terminal_offline" };
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

  // Callback de venda do ControlPay (URL Callback Venda configurada no PayGo).
  // A PayGo só envia os IDs como query params; o status real é confirmado
  // consultando a intenção de venda pela API.
  callbackVendaPayGo = async (req: Request, res: Response) => {
    try {
      const intencaoVendaId = String(
        req.query.intencaoVendaId || req.body?.intencaoVendaId || "",
      ).trim();
      const referencia = String(
        req.query.intencaoVendaReferencia ||
          req.body?.intencaoVendaReferencia ||
          "",
      ).trim();

      console.log("[PayGo] Callback venda recebido:", {
        intencaoVendaId,
        referencia,
      });

      if (!intencaoVendaId) {
        res.status(200).json({ ok: true });
        return;
      }

      const intencao = await this.getIntencaoVendaPayGo(intencaoVendaId);
      const status = this.extrairStatusIntencao(intencao);

      if (status === PAYGO_STATUS.CREDITADO) {
        const itens =
          TokenAtendimento.faturasPorVenda.get(intencaoVendaId) ||
          (referencia || String(intencao?.referencia || ""))
            .split(/[,-]/)
            .filter(Boolean)
            .map((id) => ({ id }));
        if (itens.length) {
          await this.marcarFaturasPagas(itens);
          TokenAtendimento.faturasPorVenda.delete(intencaoVendaId);
        }
      }

      res.status(200).json({ ok: true });
    } catch (error: any) {
      console.log(
        "[PayGo] Erro no callback de venda:",
        error.response?.data || error,
      );
      // Devolve erro para a PayGo reenviar o callback depois.
      res.status(500).json({ error: "Erro ao processar callback" });
    }
  };

  private gerarPagamentoCartaoUnico = async (
    req: Request,
    res: Response,
    tipo: "credito" | "debito",
  ) => {
    try {
      const { login } = req.body;

      const cliente = await this.clienteRepo.findOne({
        where: { login, cli_ativado: "s" },
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

      const result = await this.criarVendaPayGo({
        faturas: [{ id: fatura.id, valor }],
        tipo,
      });

      if (!result.ok) {
        res.status(200).json({ terminalBusy: true, reason: result.reason });
        return;
      }

      res.status(200).json({
        id: fatura.id,
        valor,
        order: { id: result.intencaoVendaId },
        dataPagamento: fatura.datavenc,
      });
    } catch (error: any) {
      console.log(
        "[PayGo] Erro ao gerar pagamento de cartão:",
        error.response?.data || error,
      );
      res.status(500).json({ error: "Erro ao gerar pagamento" });
    }
  };

  obterListaTerminaisEGerarPagamentoCredito = async (
    req: Request,
    res: Response,
  ) => this.gerarPagamentoCartaoUnico(req, res, "credito");

  obterListaTerminaisEGerarPagamentoDebito = async (
    req: Request,
    res: Response,
  ) => this.gerarPagamentoCartaoUnico(req, res, "debito");

  // Procura intenções de venda ainda pendentes / em andamento no terminal e
  // cancela cada uma. Não precisa do ID da venda — varre o terminal — então
  // libera o pinpad mesmo quando o totem não chegou a receber o ID (ex.: o
  // cliente saiu da tela antes de a venda terminar de ser criada).
  liberarTerminal = async (_req: Request, res: Response) => {
    try {
      // O filtro por "status" do GetByFiltros não funciona — então buscamos
      // todas as vendas recentes do terminal e filtramos aqui no código.
      let lista: any[] = [];
      try {
        const r = await axios.post(
          paygoUrl("IntencaoVenda/GetByFiltros"),
          { terminalId: PAYGO_TERMINAL_ID },
          { headers: PAYGO_HEADERS },
        );
        lista =
          r.data?.intencoesVendas ||
          r.data?.intencaoVendas ||
          r.data?.data ||
          [];
      } catch (err: any) {
        console.log(
          "[PayGo] Falha ao buscar vendas do terminal:",
          err.response?.data || err.message,
        );
      }

      let canceladas = 0;
      for (const intencao of lista) {
        // Só cancela o que está aberto. Nunca cancela uma venda já creditada
        // (isso dispararia um estorno no pinpad).
        const status = this.extrairStatusIntencao(intencao);
        if (
          status !== PAYGO_STATUS.PENDENTE &&
          status !== PAYGO_STATUS.EM_PAGAMENTO
        ) {
          continue;
        }
        const id = intencao?.id ? String(intencao.id) : null;
        if (!id) continue;
        try {
          await axios.post(
            paygoUrl("Venda/CancelarVenda"),
            {
              intencaoVendaId: id,
              terminalId: PAYGO_TERMINAL_ID,
              senhaTecnica: PAYGO_CANCEL_PASS,
            },
            { headers: PAYGO_HEADERS },
          );
          TokenAtendimento.faturasPorVenda.delete(id);
          canceladas++;
        } catch (err: any) {
          console.log(
            `[PayGo] Falha ao cancelar venda ${id}:`,
            err.response?.data || err.message,
          );
        }
      }

      const vendas = lista.map((iv: any) => ({
        id: iv?.id,
        status: this.extrairStatusIntencao(iv),
        statusNome: iv?.intencaoVendaStatus?.nome,
      }));
      console.log(
        `[PayGo] liberarTerminal: ${canceladas} cancelada(s) de ${lista.length} venda(s)`,
        vendas,
      );
      res
        .status(200)
        .json({ ok: true, canceladas, total: lista.length, vendas });
    } catch (error: any) {
      console.log(
        "[PayGo] Erro ao liberar terminal:",
        error.response?.data || error,
      );
      res.status(500).json({ error: "Erro ao liberar terminal" });
    }
  };

  cancelarOrder = async (req: Request, res: Response) => {
    try {
      const { order } = req.params;
      if (!order) {
        res.status(400).json({ error: "Order ID não informado" });
        return;
      }

      // Só cancela se a venda ainda estiver pendente / em andamento.
      // Cancelar uma venda já creditada dispara um estorno no pinpad
      // (pede o cartão de novo), o que não queremos no fluxo do totem.
      const intencao = await this.getIntencaoVendaPayGo(String(order));
      const status = this.extrairStatusIntencao(intencao);

      if (
        status !== PAYGO_STATUS.PENDENTE &&
        status !== PAYGO_STATUS.EM_PAGAMENTO
      ) {
        TokenAtendimento.faturasPorVenda.delete(String(order));
        res.status(200).json({ ok: true, status });
        return;
      }

      try {
        await axios.post(
          paygoUrl("Venda/CancelarVenda"),
          {
            intencaoVendaId: String(order),
            terminalId: PAYGO_TERMINAL_ID,
            senhaTecnica: PAYGO_CANCEL_PASS,
            aguardarTefIniciarTransacao: true,
          },
          { headers: PAYGO_HEADERS },
        );
        TokenAtendimento.faturasPorVenda.delete(String(order));
        res.status(200).json({ ok: true });
      } catch (err: any) {
        console.log(
          "[PayGo] Falha ao cancelar venda:",
          err.response?.data || err.message,
        );
        res.status(200).json({ ok: false });
      }
    } catch (error: any) {
      console.log("[PayGo] Erro ao cancelar venda:", error);
      res.status(500).json({ error: "Erro ao cancelar venda" });
    }
  };

  obterOrderPorId = async (req: Request, res: Response) => {
    try {
      const { order } = req.params;
      if (!order) {
        res.status(400).json({ error: "Order ID não informado" });
        return;
      }

      const intencao = await this.getIntencaoVendaPayGo(String(order));
      if (!intencao) {
        res.status(404).json({ error: "Venda nao encontrada" });
        return;
      }

      const status = this.extrairStatusIntencao(intencao);
      let statusTexto = "pending";

      if (status === PAYGO_STATUS.CREDITADO) {
        statusTexto = "approved";
        const itens =
          TokenAtendimento.faturasPorVenda.get(String(order)) ||
          String(intencao.referencia || "")
            .split(/[,-]/)
            .filter(Boolean)
            .map((id) => ({ id }));
        if (itens.length) {
          await this.marcarFaturasPagas(itens);
          TokenAtendimento.faturasPorVenda.delete(String(order));
        }
      } else if (status === PAYGO_STATUS.EXPIRADO) {
        statusTexto = "expired";
      } else if (status === PAYGO_STATUS.CANCELADO) {
        statusTexto = "canceled";
      } else if (status === PAYGO_STATUS.RECUSADO) {
        const recusaReal = this.foiRecusaReal(intencao);
        statusTexto = recusaReal ? "declined" : "failed";
        console.log(
          `[PayGo] Venda ${order} status 25 — recusaReal=${recusaReal}`,
          (intencao?.pagamentosExternos || []).map((p: any) => ({
            codigoRespostaAdquirente: p?.codigoRespostaAdquirente,
            mensagemRespostaAdquirente: p?.mensagemRespostaAdquirente,
            nsuTid: p?.nsuTid,
            adquirente: p?.adquirente,
            bandeira: p?.bandeira,
          })),
        );
      }

      res.status(200).json({ status: statusTexto, paygoStatus: status });
    } catch (error: any) {
      console.log(
        "[PayGo] Erro ao consultar venda:",
        error.response?.data || error,
      );
      res.status(500).json({ error: "Erro ao consultar venda" });
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

  private gerarPagamentoCartaoMultiplo = async (
    req: Request,
    res: Response,
    tipo: "credito" | "debito",
  ) => {
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

      const faturasComValor: { id: number; valor: number }[] = [];
      for (const fatura of faturas) {
        const valor = await this.aplicarJuros_Desconto(
          fatura.valor,
          fatura.login,
          fatura.datavenc,
        );
        faturasComValor.push({ id: fatura.id, valor });
      }
      const total = faturasComValor.reduce((acc, f) => acc + f.valor, 0);

      const result = await this.criarVendaPayGo({
        faturas: faturasComValor,
        tipo,
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
        id: titulos.join("-"),
        order: { id: result.intencaoVendaId },
        valor: total.toFixed(2),
        dataPagamento: new Date(),
      });
    } catch (error: any) {
      console.log(
        "[PayGo] Erro ao gerar pagamento múltiplo:",
        error.response?.data || error,
      );
      res.status(500).json({ error: "Erro ao gerar pagamento múltiplo" });
    }
  };

  gerarPagamentoMultiploCredito = async (req: Request, res: Response) =>
    this.gerarPagamentoCartaoMultiplo(req, res, "credito");

  gerarPagamentoMultiploDebito = async (req: Request, res: Response) =>
    this.gerarPagamentoCartaoMultiplo(req, res, "debito");
}

export default TokenAtendimento;
