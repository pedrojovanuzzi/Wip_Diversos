import AppDataSource from "../../database/DataSource";
import { ServiceLink } from "../../entities/ServiceLink";
import { SolicitacaoServico } from "../../entities/SolicitacaoServico";
import { ServicoWeb, resolverServico } from "./catalogo";

/**
 * Valor negociado no link, quando houver. `null` na coluna significa "usa o
 * preço padrão do catálogo".
 */
export function aplicarValorDoLink(
  servico: ServicoWeb,
  link: ServiceLink,
): ServicoWeb {
  if (link.valor === null || link.valor === undefined) return servico;
  const valor = Number(link.valor);
  if (!Number.isFinite(valor) || valor < 0) return servico;
  return { ...servico, valor };
}

/**
 * Cria o contrato no ZapSign e guarda o token na solicitação. Devolve null se
 * o ZapSign falhar — o atendimento consegue reenviar pela tela interna.
 */
export async function gerarContrato(
  servico: ServicoWeb,
  solicitacao: SolicitacaoServico,
  dados: Record<string, any>,
  pago: boolean,
): Promise<{
  url: string | null;
  token: string;
  /** Troca de titularidade: link do segundo signatário (novo titular). */
  url_novo_titular?: string | null;
} | null> {
  if (!servico.criarContrato) return null;
  try {
    const valorContrato = pago
      ? servico.valor.toFixed(2)
      : servico.permiteGratisFidelidade
        ? "0,00"
        : dados.valor;
    const zapResponse = await servico.criarContrato({
      ...dados,
      valor: valorContrato,
    });
    const url = zapResponse?.signers?.[0]?.sign_url ?? null;
    // O segundo signatário só existe na troca de titularidade.
    const urlNovoTitular = zapResponse?.second_signer?.sign_url ?? null;

    solicitacao.token_zapsign = zapResponse?.token;
    if (urlNovoTitular) {
      solicitacao.dados = {
        ...(solicitacao.dados || {}),
        sign_url_novo_titular: urlNovoTitular,
      };
    }
    await AppDataSource.getRepository(SolicitacaoServico).save(solicitacao);
    return { url, token: zapResponse?.token, url_novo_titular: urlNovoTitular };
  } catch (e: any) {
    console.error(
      "[ServiceLink] Erro ao gerar contrato ZapSign:",
      e?.response?.data || e?.message || e,
    );
    return null;
  }
}

/**
 * Na opção paga o contrato só sai depois do Pix confirmado (mesma regra do
 * bot). Chamado tanto pelo polling da página pública quanto pelo webhook do
 * Pix — o token na solicitação garante um documento só.
 *
 * @returns a URL de assinatura quando o contrato é criado agora.
 */
export async function liberarContratoPosPagamento(
  solicitacao: SolicitacaoServico,
): Promise<string | null> {
  const token = solicitacao.dados?.token_link;
  if (!token || solicitacao.token_zapsign) return null;

  const linkRepo = AppDataSource.getRepository(ServiceLink);
  const link = await linkRepo.findOne({ where: { token: String(token) } });
  if (!link?.resultado?.contrato_apos_pagamento) return null;
  if (link.resultado?.zapsign?.url) return null;

  const base = await resolverServico(link.servico);
  if (!base) return null;

  const zapsign = await gerarContrato(
    aplicarValorDoLink(base, link),
    solicitacao,
    solicitacao.dados || {},
    true,
  );
  if (!zapsign?.url) return null;

  link.resultado = {
    ...link.resultado,
    zapsign,
    contrato_apos_pagamento: false,
  };
  await linkRepo.save(link);
  return zapsign.url;
}
