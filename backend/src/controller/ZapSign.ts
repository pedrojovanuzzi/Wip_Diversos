import axios from "axios";
import { Request, Response } from "express";
import moment from "moment";
import dotenv from "dotenv";
import ApiMkDataSource from "../database/API_MK";
import AppDataSource from "../database/DataSource";
import ZapSignTemplates from "../entities/APIMK/ZapSignTemplates";
import { SolicitacaoServico } from "../entities/SolicitacaoServico";
import { whatsappOutgoingQueue } from "./whatsapp/index";
import Whatsapp from "./Whatsapp";
import MkauthDataSource from "../database/MkauthSource";
import { ClientesEntities } from "../entities/ClientesEntities";
import { SisPlano } from "../entities/SisPlano";
import { v4 as uuidv4 } from "uuid";
import { deleteSession } from "./whatsapp/services/session.service";
import { criarChamadoMkauth } from "./whatsapp/services/chamado.service";

dotenv.config();

const isSandbox = process.env.SERVIDOR_HOMOLOGACAO === "true";

const formatVelocidade = (velup?: number | null, veldown?: number | null): string => {
  if (!velup && !veldown) return "Consultar Viabilidade";
  const up = velup ? `${velup} Kbps` : "N/A";
  const down = veldown ? `${veldown} Kbps` : "N/A";
  return `Upload: ${up} / Download: ${down}`;
};

const CNPJ_PROVEDOR = process.env.CPF_CNPJ || "";
const formatCnpj = (raw: string): string => {
  const d = raw.replace(/\D/g, "");
  if (d.length === 14)
    return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11)
    return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return raw;
};

/**
 * Filtro universal de variáveis para documentos ZapSign.
 * Recebe qualquer params (dados do cliente + contexto) e retorna
 * o array {de, para}[] preenchendo TODAS as variáveis possíveis.
 * Variáveis sem valor ficam como string vazia.
 */
async function buildUniversalZapSignData(params: Record<string, any>): Promise<Array<{de: string; para: string}>> {
  const s = (key: string, ...fallbacks: string[]): string => {
    let val = params[key];
    if (val !== undefined && val !== null && String(val).trim() !== "") return String(val);
    for (const fb of fallbacks) {
      val = params[fb];
      if (val !== undefined && val !== null && String(val).trim() !== "") return String(val);
    }
    return "";
  };

  // Resolve plano → SisPlano (velup, veldown, valor)
  const planoNome = s("plano");
  const planoRecord = planoNome
    ? await MkauthDataSource.getRepository(SisPlano).findOne({ where: { nome: planoNome } })
    : null;

  // Gera termo se vazio: último sis_cliente ID + 1 → "{id}C/{ano}"
  let termo = s("termo");
  if (!termo) {
    const [lastCliente] = await MkauthDataSource.getRepository(ClientesEntities).find({
      select: { id: true },
      order: { id: "DESC" },
      take: 1,
    });
    const nextId = (lastCliente?.id ?? 0) + 1;
    termo = `${nextId}C/${new Date().getFullYear()}`;
  }

  const telefone = s("telefone_conversa", "telefone", "celular");
  const endereco = s("endereco", "rua");
  const numero = s("numero");
  const complemento = s("complemento");
  const enderecoCompleto = [endereco, numero, complemento].filter(Boolean).join(", ");
  const valorPlano = s("valor_plano") || planoRecord?.valor || "";
  const velocidade = formatVelocidade(planoRecord?.velup, planoRecord?.veldown);
  const uploadStr = planoRecord?.velup ? `${planoRecord.velup} Kbps` : "";
  const downloadStr = planoRecord?.veldown ? `${planoRecord.veldown} Kbps` : "";

  return [
    // --- Dados do provedor ---
    { de: "{{provedornome}}", para: "Wip Telecom" },
    { de: "{{provedorcnpj}}", para: formatCnpj(CNPJ_PROVEDOR) },
    { de: "{{provedoremail}}", para: "financeiro@wiptelecom.com.br" },
    // --- Dados do documento ---
    { de: "{{termo}}", para: termo },
    { de: "{{data}}", para: moment().format("DD/MM/YYYY") },
    // --- Dados do cliente ---
    { de: "{{nomecliente}}", para: s("nome") },
    { de: "{{cpfcliente}}", para: s("cpf") },
    { de: "{{rgcliente}}", para: s("rg") || "Não informado" },
    { de: "{{emailcliente}}", para: s("email") },
    { de: "{{fonecliente}}", para: telefone },
    { de: "{{celularcliente}}", para: telefone },
    { de: "{{celular2cliente}}", para: s("celular2", "celularSecundario") },
    { de: "{{logincliente}}", para: s("login") },
    // --- Endereço de instalação ---
    { de: "{{enderecocliente}}", para: enderecoCompleto },
    { de: "{{bairrocliente}}", para: s("bairro") },
    { de: "{{cidadecliente}}", para: s("cidade") },
    { de: "{{estadocliente}}", para: s("estado") },
    { de: "{{cepcliente}}", para: s("cep") },
    // --- Endereço residencial (espelha instalação se não informado) ---
    { de: "{{enderecorescliente}}", para: enderecoCompleto },
    { de: "{{numerorescliente}}", para: numero },
    { de: "{{bairrorescliente}}", para: s("bairro") },
    { de: "{{cidaderescliente}}", para: s("cidade") },
    { de: "{{estadorescliente}}", para: s("estado") },
    { de: "{{ceprescliente}}", para: s("cep") },
    // --- Plano e valores ---
    { de: "{{planodeacesso}}", para: planoNome },
    { de: "{{velocidadeplano}}", para: velocidade },
    { de: "{{upload}}", para: uploadStr },
    { de: "{{download}}", para: downloadStr },
    { de: "{{mensalidade}}", para: valorPlano },
    { de: "{{valor}}", para: s("valor") || "0,00" },
    { de: "{{valor_plano}}", para: valorPlano },
    { de: "{{descontocliente}}", para: s("desconto") || "0,00" },
    { de: "{{diavencimento}}", para: s("vencimento", "venc") },
    { de: "{{equipamento}}", para: s("equipamento") || "Roteador em Comodato" },
    // --- Troca de titularidade (segundo titular) ---
    { de: "{{novotitular}}", para: s("nome_novo_titular") },
    { de: "{{celularnovotitular}}", para: s("celular_novo_titular") },
    { de: "{{termo2}}", para: s("termo2") },
    { de: "{{logincliente2}}", para: s("login_novo_titular") },
    { de: "{{nomecliente2}}", para: s("nome_novo_titular") },
    { de: "{{cpfcliente2}}", para: s("cpf_novo_titular") },
    { de: "{{rgcliente2}}", para: s("rg_novo_titular") || "Não informado" },
    { de: "{{enderecoresclient2}}", para: s("endereco_novo_titular") },
    { de: "{{numerorescliente2}}", para: s("numero_novo_titular") },
    { de: "{{celularcliente2}}", para: s("celular_novo_titular") },
    { de: "{{celular2cliente2}}", para: s("celular2_novo_titular") },
    { de: "{{emailcliente2}}", para: s("email_novo_titular") },
    // --- Novo endereço (Mudança de Endereço) ---
    { de: "{{enderecocliente2}}", para: s("novo_endereco", "novo_rua") },
    { de: "{{numerocliente2}}", para: s("novo_numero") },
    { de: "{{bairrocliente2}}", para: s("novo_bairro", "bairro_novo_titular") },
    { de: "{{cidadecliente2}}", para: s("novo_cidade") },
    { de: "{{estadocliente2}}", para: s("novo_estado") },
    { de: "{{cepcliente2}}", para: s("novo_cep") },
  ];
}

const waToken = isSandbox
  ? process.env.CLOUD_API_ACCESS_TOKEN_TEST
  : process.env.CLOUD_API_ACCESS_TOKEN;

const waUrl = isSandbox
  ? `https://graph.facebook.com/v22.0/${process.env.WA_PHONE_NUMBER_ID_TEST}/messages`
  : `https://graph.facebook.com/v22.0/${process.env.WA_PHONE_NUMBER_ID}/messages`;

// Todas as funções createContract* aceitam Record<string, any> e usam
// buildUniversalZapSignData() para resolver as variáveis do documento.

class ZapSign {
  createContractInstalacao = async (params: Record<string, any>) => {
    try {
      const valor = params.valor || "0,00";
      const tipo =
        valor === "0,00" || valor === "0" || valor === "0.00" ? "gratis" : "pago";

      const template = await ApiMkDataSource.getRepository(ZapSignTemplates).findOne({
        where: { nome_servico: "Instalação", tipo },
      });
      if (!template?.token_id) throw new Error("Token do template 'Instalação' não encontrado.");

      const zapData = await buildUniversalZapSignData(params);

      const response = await axios.post(
        isSandbox
          ? "https://sandbox.api.zapsign.com.br/api/v1/models/create-doc/"
          : "https://api.zapsign.com.br/api/v1/models/create-doc/",
        {
          template_id: template.token_id,
          signer_name: params.nome || "",
          send_automatic_email: false,
          send_automatic_whatsapp: false,
          lang: "pt-br",
          external_id: null,
          data: zapData,
          signature_placement: "<<assinatura>>",
          rubrica_placement: "<<visto>>",
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.ZAPSIGN_TOKEN}`,
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error("Error in createContractInstalacao:", error);
      throw error;
    }
  }

  createContractInstalacaoDificuldadeAcesso = async (params: Record<string, any>) => {
    try {
      const template = await ApiMkDataSource.getRepository(ZapSignTemplates).findOne({
        where: { nome_servico: "Instalação", tipo: "dificuldade_acesso" },
      });
      if (!template?.token_id) throw new Error("Token do template 'Instalação' (dificuldade_acesso) não encontrado.");

      const valorInstalacao = parseFloat(String(params.valor || "0").replace(",", "."));
      const valorMulta = 600;
      const valorTotal = valorInstalacao + valorMulta;
      const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const zapData = await buildUniversalZapSignData(params);
      // Adiciona variáveis específicas de dificuldade de acesso
      zapData.push(
        { de: "{{valor_instalacao}}", para: fmt(valorInstalacao) },
        { de: "{{valor_multa}}", para: fmt(valorMulta) },
        { de: "{{multa}}", para: fmt(valorMulta) },
        { de: "{{desconto_fidelidade}}", para: fmt(valorMulta) },
        { de: "{{valor_multa_mais_instalacao}}", para: fmt(valorTotal) },
      );

      const response = await axios.post(
        isSandbox
          ? "https://sandbox.api.zapsign.com.br/api/v1/models/create-doc/"
          : "https://api.zapsign.com.br/api/v1/models/create-doc/",
        {
          template_id: template.token_id,
          signer_name: params.nome || "",
          send_automatic_email: false,
          send_automatic_whatsapp: false,
          lang: "pt-br",
          external_id: null,
          data: zapData,
          signature_placement: "<<assinatura>>",
          rubrica_placement: "<<visto>>",
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.ZAPSIGN_TOKEN}`,
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error("Error in createContractInstalacaoDificuldadeAcesso:", error);
      throw error;
    }
  }

  createContractMudancaEndereco = async (params: Record<string, any>) => {
    try {
      const valor = params.valor || "0,00";
      const tipo =
        valor === "0,00" || valor === "0" || valor === "0.00" ? "gratis" : "pago";

      const template = await ApiMkDataSource.getRepository(ZapSignTemplates).findOne({
        where: { nome_servico: "Mudança de Endereço", tipo },
      });
      if (!template?.token_id) throw new Error("Token do template 'Mudança de Endereço' não encontrado.");

      const zapData = await buildUniversalZapSignData(params);

      const response = await axios.post(
        isSandbox
          ? "https://sandbox.api.zapsign.com.br/api/v1/models/create-doc/"
          : "https://api.zapsign.com.br/api/v1/models/create-doc/",
        {
          template_id: template.token_id,
          signer_name: params.nome || "",
          send_automatic_email: false,
          send_automatic_whatsapp: false,
          lang: "pt-br",
          external_id: null,
          data: zapData,
          signature_placement: "<<assinatura>>",
          rubrica_placement: "<<visto>>",
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.ZAPSIGN_TOKEN}`,
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error("Error in createContractMudancaEndereco:", error);
      throw error;
    }
  }

  generatePdfContratacao = async (req: Request, res: Response) => {
    try {
      const result = await this.createContractInstalacao(req.body);
      res.status(200).json(result);
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  }

  generatePdfMudancaEndereco = async (req: Request, res: Response) => {
    try {
      const result = await this.createContractMudancaEndereco(req.body);
      res.status(200).json(result);
    } catch (error) {
      console.error("Error generating Mudança Endereço PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  }

  createContractMudancaComodo = async (params: Record<string, any>) => {
    try {
      const valor = params.valor || "0,00";
      const tipo =
        valor === "0,00" || valor === "0" || valor === "0.00" ? "gratis" : "pago";

      const template = await ApiMkDataSource.getRepository(ZapSignTemplates).findOne({
        where: { nome_servico: "Mudança de Cômodo", tipo },
      });
      if (!template?.token_id) throw new Error("Token do template 'Mudança de Cômodo' não encontrado.");

      const zapData = await buildUniversalZapSignData(params);

      const response = await axios.post(
        isSandbox
          ? "https://sandbox.api.zapsign.com.br/api/v1/models/create-doc/"
          : "https://api.zapsign.com.br/api/v1/models/create-doc/",
        {
          template_id: template.token_id,
          signer_name: params.nome || "",
          send_automatic_email: false,
          send_automatic_whatsapp: false,
          lang: "pt-br",
          external_id: null,
          data: zapData,
          signature_placement: "<<assinatura>>",
          rubrica_placement: "<<visto>>",
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.ZAPSIGN_TOKEN}`,
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error("Error in createContractMudancaComodo:", error);
      throw error;
    }
  }

  generatePdfMudancaComodo = async (req: Request, res: Response) => {
    try {
      const result = await this.createContractMudancaComodo(req.body);
      res.status(200).json(result);
    } catch (error) {
      console.error("Error generating Mudança Cômodo PDF:", error);
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  }

  /**
   * Busca dados do cliente pelo login e gera todos os documentos de uma vez (somente localhost).
   */
  gerarTodosDocumentosTeste = async (req: Request, res: Response) => {
    try {
      const { login } = req.body;
      if (!login) {
        res.status(400).json({ error: "Login é obrigatório" });
        return;
      }

      const cliente = await MkauthDataSource.getRepository(ClientesEntities).findOne({
        where: { login },
      });
      if (!cliente) {
        res.status(404).json({ error: `Cliente com login "${login}" não encontrado` });
        return;
      }

      const planoRecord = cliente.plano
        ? await MkauthDataSource.getRepository(SisPlano).findOne({ where: { nome: cliente.plano } })
        : null;

      const params: Record<string, any> = {
        nome: cliente.nome,
        cpf: cliente.cpf_cnpj,
        rg: cliente.rg || "",
        email: cliente.email || "financeiro@wiptelecom.com.br",
        telefone: cliente.celular || cliente.fone || "",
        celular: cliente.celular || "",
        login: cliente.login,
        endereco: cliente.endereco,
        rua: cliente.endereco,
        numero: cliente.numero,
        complemento: cliente.complemento || "",
        bairro: cliente.bairro,
        cidade: cliente.cidade,
        estado: cliente.estado,
        cep: cliente.cep,
        plano: cliente.plano,
        valor_plano: planoRecord?.valor || "0,00",
        vencimento: cliente.venc,
        termo: cliente.termo || "",
        equipamento: "Roteador em Comodato",
        // Dados fictícios para troca de titularidade
        nome_novo_titular: "NOVO TITULAR TESTE",
        cpf_novo_titular: "000.000.000-00",
        rg_novo_titular: "00.000.000-0",
        email_novo_titular: "novotitular@teste.com",
        celular_novo_titular: "14999999999",
        endereco_novo_titular: cliente.endereco,
        numero_novo_titular: cliente.numero,
        bairro_novo_titular: cliente.bairro,
        // Dados fictícios para mudança de endereço
        novo_rua: "Rua Teste Novo Endereço",
        novo_numero: "999",
        novo_bairro: "Bairro Novo Teste",
        novo_cidade: "Cidade Nova Teste",
        novo_estado: "SP",
        novo_cep: "17000-000",
      };

      const resultados: Record<string, any> = {};
      const erros: Record<string, string> = {};

      // 1. Instalação Grátis
      try {
        resultados["Instalação (grátis)"] = await this.createContractInstalacao({ ...params, valor: "0.00" });
      } catch (e: any) { erros["Instalação (grátis)"] = e.message; }

      // 2. Instalação Paga
      try {
        resultados["Instalação (pago)"] = await this.createContractInstalacao({ ...params, valor: "200.00" });
      } catch (e: any) { erros["Instalação (pago)"] = e.message; }

      // 3. Instalação Dificuldade de Acesso
      try {
        resultados["Instalação (dificuldade_acesso)"] = await this.createContractInstalacaoDificuldadeAcesso({ ...params, valor: "200.00" });
      } catch (e: any) { erros["Instalação (dificuldade_acesso)"] = e.message; }

      // 4. Mudança de Endereço Grátis
      try {
        resultados["Mudança de Endereço (grátis)"] = await this.createContractMudancaEndereco({ ...params, valor: "0.00" });
      } catch (e: any) { erros["Mudança de Endereço (grátis)"] = e.message; }

      // 5. Mudança de Endereço Paga
      try {
        resultados["Mudança de Endereço (pago)"] = await this.createContractMudancaEndereco({ ...params, valor: "200.00" });
      } catch (e: any) { erros["Mudança de Endereço (pago)"] = e.message; }

      // 6. Mudança de Cômodo Grátis
      try {
        resultados["Mudança de Cômodo (grátis)"] = await this.createContractMudancaComodo({ ...params, valor: "0.00" });
      } catch (e: any) { erros["Mudança de Cômodo (grátis)"] = e.message; }

      // 7. Mudança de Cômodo Paga
      try {
        resultados["Mudança de Cômodo (pago)"] = await this.createContractMudancaComodo({ ...params, valor: "200.00" });
      } catch (e: any) { erros["Mudança de Cômodo (pago)"] = e.message; }

      // 8. Alteração de Plano
      try {
        resultados["Alteração de Plano"] = await this.createContractAlteracaoPlano(params);
      } catch (e: any) { erros["Alteração de Plano"] = e.message; }

      // 9. Troca de Titularidade (Titular)
      try {
        resultados["Troca de Titularidade (titular)"] = await this.createContractTrocaTitularidadeTitular(params);
      } catch (e: any) { erros["Troca de Titularidade (titular)"] = e.message; }

      // 10. Troca de Titularidade (Novo Titular)
      try {
        resultados["Troca de Titularidade (novo titular)"] = await this.createContractTrocaTitularidadeNovoTitular(params);
      } catch (e: any) { erros["Troca de Titularidade (novo titular)"] = e.message; }

      const docs = Object.entries(resultados).map(([servico, data]) => ({
        servico,
        sign_url: data?.signers?.[0]?.sign_url || null,
        token: data?.token || null,
        second_signer_url: data?.second_signer?.sign_url || null,
      }));

      res.status(200).json({ cliente: { login: cliente.login, nome: cliente.nome }, docs, erros });
    } catch (error: any) {
      console.error("Error in gerarTodosDocumentosTeste:", error);
      res.status(500).json({ error: error.message || "Erro ao gerar documentos de teste" });
    }
  }

  /**
   * Busca dados do cliente pelo login (somente localhost).
   */
  buscarClientePorLogin = async (req: Request, res: Response) => {
    try {
      const { login } = req.params;
      const cliente = await MkauthDataSource.getRepository(ClientesEntities).findOne({
        select: { id: true, nome: true, login: true, cpf_cnpj: true, rg: true, email: true, celular: true, endereco: true, numero: true, complemento: true, bairro: true, cidade: true, estado: true, cep: true, plano: true, venc: true, termo: true },
        where: { login },
      });
      if (!cliente) {
        res.status(404).json({ error: "Cliente não encontrado" });
        return;
      }
      res.status(200).json(cliente);
    } catch (error: any) {
      console.error("Error in buscarClientePorLogin:", error);
      res.status(500).json({ error: error.message });
    }
  }

  webhook = async (req: Request, res: Response) => {
    try {
      console.log("[ZapSign Webhook] Body completo:", JSON.stringify(req.body));
      const { event_type } = req.body;
      const token: string = req.body.token || req.body.document?.token;
      console.log(`[ZapSign Webhook] Evento: ${event_type} | Token: ${token}`);

      // ZapSign pode enviar "doc_signed" como último evento mesmo quando todos assinaram.
      // Detectamos isso verificando se o status do documento é "signed".
      const docFullySigned =
        req.body.status === "signed" &&
        Array.isArray(req.body.signers) &&
        req.body.signers.every((s: any) => s.status === "signed");

      if (event_type === "doc_signed") {
        const repo = AppDataSource.getRepository(SolicitacaoServico);
        const solicitacao = await repo.findOne({ where: { token_zapsign: token } });
        if (solicitacao) {
          const servicoNorm = solicitacao.servico?.toLowerCase();
          // Notifica novo titular apenas na primeira assinatura (quando ainda faltam signatários)
          if (
            (servicoNorm === "alteração de titularidade titular" || servicoNorm === "troca de titularidade titular" || servicoNorm === "troca_titularidade_titular") &&
            !solicitacao.dados?.titular_assinou &&
            !docFullySigned &&
            !solicitacao.assinado
          ) {
            solicitacao.dados = { ...solicitacao.dados, titular_assinou: true };
            await repo.save(solicitacao);
            await this.notificarNovoTitular(solicitacao);
          }
        }
      }

      if (event_type === "all_signed" || docFullySigned) {
        console.log(`[ZapSign Webhook] Processando assinatura completa para token: ${token}`);
        const repo = AppDataSource.getRepository(SolicitacaoServico);

        const solicitacao = await repo.findOne({
          where: { token_zapsign: token },
        });

        console.log(`[ZapSign Webhook] Solicitação encontrada: ${solicitacao ? `ID ${solicitacao.id} (${solicitacao.servico})` : "NÃO ENCONTRADA"}`);

        if (solicitacao) {
          solicitacao.assinado = true;
          await repo.save(solicitacao);
          console.log(
            `[ZapSign Webhook] Solicitação ID ${solicitacao.id} marcada como assinada (Token: ${token}).`,
          );

          // Notificar o Cliente sobre a assinatura confirmada
          try {
            let requesterPhone = "";
            if (solicitacao.dados && solicitacao.dados.telefone_conversa) {
              const cleanReqPhone = solicitacao.dados.telefone_conversa.replace(
                /\D/g,
                "",
              );
              requesterPhone = cleanReqPhone.startsWith("55")
                ? cleanReqPhone
                : "55" + cleanReqPhone;
            } else if (solicitacao.dados && solicitacao.dados.telefone) {
              const cleanReqPhone = solicitacao.dados.telefone.replace(
                /\D/g,
                "",
              );
              requesterPhone = cleanReqPhone.startsWith("55")
                ? cleanReqPhone
                : "55" + cleanReqPhone;
            }

            if (requesterPhone) {
              const servicoNorm = (solicitacao.servico || "").toLowerCase();
              const isTitular = servicoNorm.includes("titularidade titular") && !servicoNorm.includes("novo titular");
              const msgAssinatura = isTitular
                ? `✅ *Assinatura Confirmada!*\n\nOlá ${solicitacao.dados?.nome || "Cliente"}, recebemos a sua assinatura para o serviço: *${solicitacao.servico || "Contratado"}*.\n\nTudo certo, daremos continuidade do serviço com o novo titular, obrigado! 🙏🏻`
                : `✅ *Assinatura Confirmada!*\n\nOlá ${solicitacao.dados?.nome || "Cliente"}, recebemos a sua assinatura para o serviço: *${solicitacao.servico || "Contratado"}*.\n\nAgradecemos a confiança! Em breve nossa equipe entrará em contato para confirmação do serviço. 🚀`;
              await Whatsapp.MensagensComuns(requesterPhone, msgAssinatura);
              await deleteSession(requesterPhone);
            }
          } catch (errConv) {
            console.error(
              "[ZapSign Webhook] Erro ao notificar cliente:",
              errConv,
            );
          }

          // Enviar notificação para o celular de teste do .env (Funcionário)
          const testPhone = process.env.TEST_PHONE;
          if (testPhone) {
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
                    name: "notificacao_assinatura",
                    language: {
                      code: "pt_BR",
                    },
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
          }

          // === Integração com MKAuth após Assinatura ===
          try {
            const dados = solicitacao.dados;
            if (dados) {
              const servicoNormalizado = solicitacao.servico?.toLowerCase();
              switch (servicoNormalizado) {
                case "instalação":
                case "instalacao":
                  const loginCriado = await this.registerClientInMkAuth(dados);
                  console.log(`[ZapSign Webhook] Cliente ${dados.nome} cadastrado no MKAuth para Instalação. Login: ${loginCriado}`);
                  try {
                    const msgChamado =
                      `Cliente solicitou novo cadastro via WhatsApp e assinou o contrato.\n\n` +
                      `👤 Nome: ${dados.nome || "-"}\n` +
                      `📄 CPF: ${dados.cpf || "-"}\n` +
                      `🪪 RG/IE: ${dados.rg || "-"}\n` +
                      `📱 Celular: ${dados.celular || "-"}\n` +
                      `📧 E-mail: ${dados.email || "-"}\n` +
                      `📍 Endereço: ${dados.rua || "-"}, ${dados.numero || "-"} - ${dados.bairro || "-"}\n` +
                      `🏙️ Cidade: ${dados.cidade || "-"}/${dados.estado || "-"}\n` +
                      `📮 CEP: ${dados.cep || "-"}\n` +
                      `📶 Plano: ${dados.plano || "-"}\n` +
                      `📅 Vencimento: Dia ${dados.vencimento || "-"}`;
                    await criarChamadoMkauth(
                      "INSTALACAO",
                      { nome: dados.nome, login: loginCriado, email: dados.email || "" },
                      msgChamado,
                      solicitacao,
                    );
                  } catch (eChamado) {
                    console.error("[ZapSign Webhook] Erro ao criar chamado de instalação:", eChamado);
                  }
                  break;
                case "mudança de endereço":
                case "mudanca_endereco":
                  // Para mudança de endereço, atualizamos o cadastro existente
                  // Tenta pegar o login dos dados ou do próprio registro da solicitação
                  const login = dados.login || solicitacao.login_cliente;
                  if (
                    login &&
                    login !== "Desconhecido" &&
                    login !== "Não informado"
                  ) {
                    await this.updateClientAddressInMkAuth(login, dados);
                    console.log(
                      `[ZapSign Webhook] Endereço do cliente ${login} atualizado no MKAuth (Serviço: ${solicitacao.servico}).`,
                    );
                  } else {
                    console.warn(
                      `[ZapSign Webhook] Login não identificado para atualização de endereço: ${solicitacao.id}`,
                    );
                  }
                  break;
                case "alteração de plano":
                case "alteracao de plano":
                  const loginPlano = dados.login || solicitacao.login_cliente;
                  if (
                    loginPlano &&
                    loginPlano !== "Desconhecido" &&
                    loginPlano !== "Não informado"
                  ) {
                    await this.updateClientPlanInMkAuth(loginPlano, dados);
                    console.log(
                      `[ZapSign Webhook] Plano do cliente ${loginPlano} atualizado no MKAuth (Serviço: ${solicitacao.servico}).`,
                    );
                  } else {
                    console.warn(
                      `[ZapSign Webhook] Login não identificado para atualização de plano: ${solicitacao.id}`,
                    );
                  }
                  break;
                case "alteração de titularidade titular":
                case "troca de titularidade titular":   // legado
                case "troca_titularidade_titular":       // legado
                  // notificarNovoTitular é chamado no doc_signed (primeira assinatura)
                  await this.verificarEFinalizarTrocaTitularidade(solicitacao, repo);
                  break;
                case "alteração de titularidade novo titular":
                case "troca de titularidade novo titular":  // legado
                  await this.verificarEFinalizarTrocaTitularidade(solicitacao, repo);
                  break;
                default:
                  console.log(
                    `[ZapSign Webhook] Serviço '${solicitacao.servico}' não requer integração MKAuth específica no momento.`,
                  );
                  break;
              }
            }
          } catch (mkError) {
            console.error(
              "[ZapSign Webhook] Erro ao integrar com MKAuth:",
              mkError,
            );
          }
        } else {
          console.warn(
            `[ZapSign Webhook] Nenhuma solicitação encontrada para o token: ${token}`,
          );
        }
      }

      res.status(200).send("OK");
    } catch (error) {
      console.error("[ZapSign Webhook] Erro ao processar:", error);
      res.status(500).send("Internal Server Error");
    }
  }

  // === Métodos Auxiliares para Alteração de Titularidade ===

  private notificarNovoTitular = async (_solicitacao: SolicitacaoServico) => {
    // Notificação de "aguardando assinatura do novo titular" removida a pedido
  }

  private verificarEFinalizarTrocaTitularidade = async (
    solicitacaoAssinada: SolicitacaoServico,
    repo: ReturnType<typeof AppDataSource.getRepository<SolicitacaoServico>>,
  ) => {
    try {
      const isNovoTitular = (solicitacaoAssinada.servico || "").toLowerCase().includes("novo titular");

      let solicitacaoTitular: SolicitacaoServico | null = null;
      let solicitacaoNovoTitular: SolicitacaoServico | null = null;

      if (isNovoTitular) {
        solicitacaoNovoTitular = solicitacaoAssinada;
        const idTitular = solicitacaoAssinada.dados?.solicitacao_id_titular;
        if (idTitular) {
          solicitacaoTitular = await repo.findOne({ where: { id: idTitular } });
        }
      } else {
        solicitacaoTitular = solicitacaoAssinada;
        const idNovoTitular = solicitacaoAssinada.dados?.solicitacao_id_novo_titular;
        if (idNovoTitular) {
          solicitacaoNovoTitular = await repo.findOne({ where: { id: idNovoTitular } });
        }
      }

      if (!solicitacaoTitular || !solicitacaoNovoTitular) {
        console.log("[AlteraçãoTitularidade] Aguardando a outra solicitação ser localizada.");
        return;
      }

      if (!solicitacaoTitular.assinado || !solicitacaoNovoTitular.assinado) {
        console.log("[AlteraçãoTitularidade] Aguardando ambas as assinaturas.");
        return;
      }

      if (solicitacaoTitular.dados?.troca_finalizada) {
        console.log("[AlteraçãoTitularidade] Troca já processada, ignorando.");
        return;
      }

      // Marca como processado para evitar execução dupla
      solicitacaoTitular.dados = { ...solicitacaoTitular.dados, troca_finalizada: true };
      await repo.save(solicitacaoTitular);

      const dadosTitular = solicitacaoTitular.dados;
      const dadosNovoTitular = solicitacaoNovoTitular.dados;

      // 1. Criar chamado no cadastro do titular original (pelo CPF)
      try {
        const cpfOriginal = (dadosTitular?.cpf || "").replace(/\D/g, "");
        if (cpfOriginal) {
          const clienteOriginal = await MkauthDataSource.getRepository(ClientesEntities).findOne({
            where: { cpf_cnpj: cpfOriginal },
          });

          const sessionFake = {
            login: clienteOriginal?.login || dadosTitular?.login || "",
            nome: clienteOriginal?.nome || dadosTitular?.nome || "",
            email: clienteOriginal?.email || dadosTitular?.email || "",
          };

          const mensagemChamado =
            `Troca de titularidade realizada em ${moment().format("DD/MM/YYYY HH:mm")}. ` +
            `Contrato assinado pelo titular e novo titular.\n\n` +
            `Dados do novo titular:\n` +
            `Nome: ${dadosNovoTitular?.nome || "Não informado"}\n` +
            `CPF: ${dadosNovoTitular?.cpf || "Não informado"}\n` +
            `E-mail: ${dadosNovoTitular?.email || "Não informado"}\n` +
            `Celular: ${dadosNovoTitular?.celular || dadosNovoTitular?.telefone_conversa || "Não informado"}`;

          await criarChamadoMkauth("ALTERAÇÃO DE TITULARIDADE", sessionFake, mensagemChamado, solicitacaoTitular);
          console.log(`[AlteraçãoTitularidade] Chamado criado para CPF ${cpfOriginal}.`);
        } else {
          console.warn("[AlteraçãoTitularidade] CPF do titular original não encontrado nos dados.");
        }
      } catch (e) {
        console.error("[AlteraçãoTitularidade] Erro ao criar chamado para titular:", e);
      }

      // 2. Criar novo cadastro no MkAuth para o novo titular e abrir chamado de instalação
      try {
        const loginNovoTitular = await this.registerClientInMkAuth(dadosNovoTitular);
        console.log(`[AlteraçãoTitularidade] Novo titular ${dadosNovoTitular?.nome} cadastrado no MKAuth. Login: ${loginNovoTitular}`);

        const msgNovoTitular =
          `Instalação originada por alteração de titularidade. Contrato assinado em ${moment().format("DD/MM/YYYY HH:mm")}.\n\n` +
          `👤 Nome: ${dadosNovoTitular?.nome || "-"}\n` +
          `📄 CPF: ${dadosNovoTitular?.cpf || "-"}\n` +
          `🪪 RG/IE: ${dadosNovoTitular?.rg || "-"}\n` +
          `📱 Celular: ${dadosNovoTitular?.celular || dadosNovoTitular?.telefone_conversa || "-"}\n` +
          `📧 E-mail: ${dadosNovoTitular?.email || "-"}\n` +
          `📍 Endereço: ${dadosNovoTitular?.rua || "-"}, ${dadosNovoTitular?.numero || "-"} - ${dadosNovoTitular?.bairro || "-"}\n` +
          `🏙️ Cidade: ${dadosNovoTitular?.cidade || "-"}/${dadosNovoTitular?.estado || "-"}\n` +
          `📮 CEP: ${dadosNovoTitular?.cep || "-"}\n` +
          `📶 Plano: ${dadosNovoTitular?.plano || "-"}\n` +
          `📅 Vencimento: Dia ${dadosNovoTitular?.vencimento || "-"}\n\n` +
          `Titular anterior: ${dadosTitular?.nome || "-"} (CPF: ${dadosTitular?.cpf || "-"})`;

        await criarChamadoMkauth(
          "INSTALACAO",
          { nome: dadosNovoTitular?.nome || "", login: loginNovoTitular, email: dadosNovoTitular?.email || "" },
          msgNovoTitular,
          solicitacaoNovoTitular,
        );
        console.log(`[AlteraçãoTitularidade] Chamado de instalação criado para novo titular ${dadosNovoTitular?.nome}.`);
      } catch (e) {
        console.error("[AlteraçãoTitularidade] Erro ao cadastrar novo titular ou criar chamado:", e);
      }
    } catch (error) {
      console.error("[AlteraçãoTitularidade] Erro ao processar finalização da troca:", error);
    }
  }

  // === Métodos Auxiliares para MKAuth ===

  private limparEndereco = (str: string, isStreet: boolean = false): string => {
    if (!str) return "";
    let clean = str
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (isStreet) {
      clean = clean
        .replace(/[^A-Z\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
    return clean;
  }

  createContractAlteracaoPlano = async (params: Record<string, any>) => {
    try {
      const template = await ApiMkDataSource.getRepository(ZapSignTemplates).findOne({
        where: { nome_servico: "Alteração de Plano", tipo: "gratis" },
      });
      if (!template?.token_id) throw new Error("Token do template 'Alteração de Plano' não encontrado.");

      const zapData = await buildUniversalZapSignData(params);

      const response = await axios.post(
        isSandbox
          ? "https://sandbox.api.zapsign.com.br/api/v1/models/create-doc/"
          : "https://api.zapsign.com.br/api/v1/models/create-doc/",
        {
          template_id: template.token_id,
          signer_name: params.nome || "",
          send_automatic_email: false,
          send_automatic_whatsapp: false,
          lang: "pt-br",
          external_id: null,
          data: zapData,
          signature_placement: "<<assinatura>>",
          rubrica_placement: "<<visto>>",
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.ZAPSIGN_TOKEN}`,
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error("Error in createContractAlteracaoPlano:", error);
      throw error;
    }
  }

  createContractTrocaTitularidadeTitular = async (params: Record<string, any>) => {
    try {
      const template = await ApiMkDataSource.getRepository(ZapSignTemplates).findOne({
        where: { nome_servico: "Troca de Titularidade", tipo: "gratis" },
      });
      if (!template?.token_id) throw new Error("Token do template 'Troca de Titularidade' não encontrado.");

      const zapData = await buildUniversalZapSignData({
        ...params,
        termo2: "Alteração de Titularidade",
      });

      const response = await axios.post(
        isSandbox
          ? "https://sandbox.api.zapsign.com.br/api/v1/models/create-doc/"
          : "https://api.zapsign.com.br/api/v1/models/create-doc/",
        {
          template_id: template.token_id,
          signer_name: params.nome || "",
          send_automatic_email: false,
          send_automatic_whatsapp: false,
          lang: "pt-br",
          external_id: null,
          data: zapData,
          signature_placement: "<<assinatura>>",
          rubrica_placement: "<<visto>>",
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.ZAPSIGN_TOKEN}`,
          },
        },
      );

      // Adiciona segundo signatário (novo titular)
      const docToken = response.data.token;
      let secondSigner: any = null;
      const nomeNovo = params.nome_novo_titular || "";
      const celularNovo = params.celular_novo_titular || "";

      if (nomeNovo && celularNovo && docToken) {
        const phoneRaw = String(celularNovo).replace(/\D/g, "");
        const phoneNumber = phoneRaw.startsWith("55") ? phoneRaw.slice(2) : phoneRaw;

        const addSignerResponse = await axios.post(
          isSandbox
            ? `https://sandbox.api.zapsign.com.br/api/v1/docs/${docToken}/add-signer/`
            : `https://api.zapsign.com.br/api/v1/docs/${docToken}/add-signer/`,
          {
            name: nomeNovo,
            phone_country: "55",
            phone_number: phoneNumber,
            signature_placement: "<<assinatura2>>",
            rubrica_placement: "<<visto2>>",
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.ZAPSIGN_TOKEN}`,
            },
          },
        );
        secondSigner = addSignerResponse.data;
      }

      return { ...response.data, second_signer: secondSigner };
    } catch (error) {
      console.error("Error in createContractTrocaTitularidadeTitular:", error);
      throw error;
    }
  }

  createContractTrocaTitularidadeNovoTitular = async (params: Record<string, any>) => {
    try {
      const templateRepo = ApiMkDataSource.getRepository(ZapSignTemplates);
      const template =
        (await templateRepo.findOne({
          where: { nome_servico: "Troca de Titularidade Novo Titular", tipo: "gratis" },
        })) ||
        (await templateRepo.findOne({
          where: { nome_servico: "Troca de Titularidade", tipo: "gratis" },
        }));
      if (!template?.token_id) throw new Error("Token do template 'Troca de Titularidade Novo Titular' não encontrado.");

      const zapData = await buildUniversalZapSignData(params);

      const response = await axios.post(
        isSandbox
          ? "https://sandbox.api.zapsign.com.br/api/v1/models/create-doc/"
          : "https://api.zapsign.com.br/api/v1/models/create-doc/",
        {
          template_id: template.token_id,
          signer_name: params.nome || "",
          send_automatic_email: false,
          send_automatic_whatsapp: false,
          lang: "pt-br",
          external_id: null,
          data: zapData,
          signature_placement: "<<assinatura>>",
          rubrica_placement: "<<visto>>",
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.ZAPSIGN_TOKEN}`,
          },
        },
      );

      return response.data;
    } catch (error) {
      console.error("Error in createContractTrocaTitularidadeNovoTitular:", error);
      throw error;
    }
  }

  private FormatarCidade = (cidade: string): string => {
    if (!cidade) return "";
    return cidade
      .toLowerCase()
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  private registerClientInMkAuth = async (dados: any): Promise<string> => {
    const ClientesRepository = MkauthDataSource.getRepository(ClientesEntities);

    // Busca código IBGE
    let ibgeCode: string | null = null;
    try {
      const ufStr = (dados.estado || "").trim().toLowerCase();
      const cityStr = (dados.cidade || "").trim().toLowerCase();
      if (ufStr && cityStr) {
        const response = await axios.get(
          `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${ufStr}/municipios`,
        );
        const municipios = response.data;
        const nmNormalized = cityStr
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^\w\s]/gi, "")
          .trim();
        const munFind = municipios.find((m: any) => {
          const mNmNorm = m.nome
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^\w\s]/gi, "")
            .trim();
          return mNmNorm === nmNormalized;
        });
        if (munFind) {
          ibgeCode = munFind.id.toString();
        }
      }
    } catch (err) {
      console.error("Erro ao buscar IBGE da API externa:");
    }

    // Garante login único
    let finalLogin =
      dados.login || (dados.nome || "").trim().replace(/\s/g, "").toUpperCase();
    const findLogin = await ClientesRepository.findOne({
      where: { login: finalLogin },
    });

    if (findLogin) {
      finalLogin = `${finalLogin}${Math.floor(Math.random() * 1000)}`;
    }

    const celularFormatado = (dados.telefone || dados.celular || "").replace(
      /\D/g,
      "",
    );
    const celular2Formatado = (dados.celularSecundario || "").replace(
      /\D/g,
      "",
    );

    const addClient = await ClientesRepository.save({
      nome: (dados.nome || "").toUpperCase(),
      login: finalLogin,
      rg: (dados.rg || "").trim().replace(/\s/g, ""),
      cpf_cnpj: (dados.cpf || "").trim().replace(/\s/g, ""),
      uuid_cliente: `019b${uuidv4().slice(0, 32)}`,
      email: (dados.email || "").trim().replace(/\s/g, ""),
      cidade: this.FormatarCidade(this.limparEndereco(dados.cidade || "")),
      bairro: this.limparEndereco(dados.bairro || ""),
      estado: (dados.estado || "").toUpperCase().replace(/\s/g, "").slice(0, 2),
      nascimento: (dados.dataNascimento || "").replace(
        /(\d{2})\/(\d{2})\/(\d{4})/,
        "$3-$2-$1",
      ),
      numero: this.limparEndereco(dados.numero || ""),
      endereco: this.limparEndereco(dados.endereco || dados.rua || "", true),
      cep: dados.cep
        ? `${dados.cep.replace(/\D/g, "").slice(0, 5)}-${dados.cep.replace(/\D/g, "").slice(5, 8)}`
        : "",
      plano: dados.plano,
      pool_name: "LAN_PPPOE",
      plano15: "Plano_15",
      plano_bloqc: "Plano_bloqueado",
      vendedor: "SCM",
      conta: "3",
      comodato: "sim",
      cidade_ibge: ibgeCode || "3503406",
      fone: "(14)3296-1608",
      venc: (dados.vencimento || "").trim().replace(/\D/g, ""),
      celular:
        celularFormatado.length >= 10
          ? `(${celularFormatado.slice(0, 2)})${celularFormatado.slice(2)}`
          : celularFormatado,
      celular2:
        celular2Formatado.length >= 10
          ? `(${celular2Formatado.slice(0, 2)})${celular2Formatado.slice(2)}`
          : celular2Formatado,
      estado_res: (dados.estado || "")
        .toUpperCase()
        .replace(/\s/g, "")
        .slice(0, 2),
      bairro_res: this.limparEndereco(dados.bairro || ""),
      tipo: "pppoe",
      cidade_res: this.FormatarCidade(this.limparEndereco(dados.cidade || "")),
      cep_res: dados.cep
        ? `${dados.cep.replace(/\D/g, "").slice(0, 5)}-${dados.cep.replace(/\D/g, "").slice(5, 8)}`
        : "",
      numero_res: this.limparEndereco(dados.numero || ""),
      endereco_res: this.limparEndereco(
        dados.endereco || dados.rua || "",
        true,
      ),
      tipo_cob: "titulo",
      mesref: "now",
      prilanc: "tot",
      pessoa:
        (dados.cpf || "").replace(/\D/g, "").length <= 11
          ? "fisica"
          : "juridica",
      dias_corte: 80,
      senha: moment().format("DDMMYYYY"),
      cadastro: moment().format("DD-MM-YYYY").split("-").join("/"),
      data_ip: moment().format("YYYY-MM-DD HH:mm:ss"),
      data_ins: moment().format("YYYY-MM-DD HH:mm:ss"),
    });

    await ClientesRepository.update(addClient.id, {
      termo: `${addClient.id}C/${moment().format("YYYY")}`,
    });

    return finalLogin;
  }

  private updateClientAddressInMkAuth = async (login: string, dados: any) => {
    const ClientesRepository = MkauthDataSource.getRepository(ClientesEntities);
    const client = await ClientesRepository.findOne({
      where: { login: login },
    });

    if (client) {
      await ClientesRepository.update(client.id, {
        endereco: this.limparEndereco(dados.rua || dados.endereco || "", true),
        numero: this.limparEndereco(dados.numero || ""),
        bairro: this.limparEndereco(dados.bairro || ""),
        cidade: this.FormatarCidade(this.limparEndereco(dados.cidade || "")),
        estado: (dados.estado || "")
          .toUpperCase()
          .replace(/\s/g, "")
          .slice(0, 2),
        cep: dados.cep
          ? `${dados.cep.replace(/\D/g, "").slice(0, 5)}-${dados.cep.replace(/\D/g, "").slice(5, 8)}`
          : client.cep,
      });
    }
  }

  private updateClientPlanInMkAuth = async (login: string, dados: any) => {
    const ClientesRepository = MkauthDataSource.getRepository(ClientesEntities);
    const client = await ClientesRepository.findOne({
      where: { login },
    });

    if (client) {
      await ClientesRepository.update(client.id, {
        plano: dados.plano || client.plano,
      });
    }
  }
}

export default new ZapSign();
