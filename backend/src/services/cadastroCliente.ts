import MkauthDataSource from "../database/MkauthSource";
import { ClientesEntities } from "../entities/ClientesEntities";

/**
 * Qual cadastro do MKAuth é "o cliente" de um CPF/CNPJ.
 *
 * Um mesmo CPF costuma ter vários cadastros no MKAuth (recontratação, mudança
 * de endereço, troca de titularidade anterior). Buscar só por `cpf_cnpj`
 * devolve o primeiro que o banco entregar — na prática o de menor id, ou seja,
 * o mais antigo e normalmente já desativado. Chamado e cobrança acabavam indo
 * parar nesse cadastro velho.
 *
 * A regra aqui é a mesma já usada no fluxo de instalação: vale o cadastro
 * criado por último, preferindo os ativos.
 */

/** Cadastro ativo mais recente do CPF/CNPJ; sem ativo, o mais recente. */
export async function buscarCadastroMaisNovoPorCpf(
  cpfCnpj: string,
): Promise<ClientesEntities | null> {
  const cpf = String(cpfCnpj || "").replace(/\D/g, "");
  if (!cpf) return null;

  const repo = MkauthDataSource.getRepository(ClientesEntities);

  const ativo = await repo.findOne({
    where: { cpf_cnpj: cpf, cli_ativado: "s" },
    order: { id: "DESC" },
  });
  if (ativo) return ativo;

  // Cadastro desativado ainda serve para abrir o chamado: é melhor acertar o
  // cadastro certo (só que inativo) do que cair em outro do mesmo CPF.
  return repo.findOne({
    where: { cpf_cnpj: cpf },
    order: { id: "DESC" },
  });
}

/**
 * As solicitações gravam "Desconhecido"/"Não informado" quando o atendimento
 * não chegou a identificar o cadastro — são texto, não login.
 */
export function loginCadastroValido(login: string | null | undefined): boolean {
  const limpo = String(login || "").trim();
  return Boolean(
    limpo && limpo !== "Desconhecido" && limpo !== "Não informado",
  );
}

/**
 * Cadastro de uma solicitação: o login já escolhido no atendimento manda, e o
 * CPF é só o plano B. O login vem da tela/flow em que o próprio cliente
 * apontou o cadastro, então é sempre mais confiável que uma busca por CPF.
 */
export async function buscarCadastroPorLoginOuCpf(
  login: string | null | undefined,
  cpfCnpj: string | null | undefined,
): Promise<ClientesEntities | null> {
  const loginLimpo = String(login || "").trim();

  if (loginCadastroValido(loginLimpo)) {
    const porLogin = await MkauthDataSource.getRepository(
      ClientesEntities,
    ).findOne({ where: { login: loginLimpo } });
    if (porLogin) return porLogin;
  }

  return buscarCadastroMaisNovoPorCpf(cpfCnpj || "");
}
