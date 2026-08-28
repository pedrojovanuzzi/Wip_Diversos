import MkauthDataSource from "../database/MkauthSource";
import { ClientesEntities } from "../entities/ClientesEntities";

/**
 * Login do cliente no MKAuth: identidade do CADASTRO, não da pessoa.
 *
 * O login sempre nasceu do nome ("JOÃO SILVA" → "JOAOSILVA"), o que faz um
 * cliente que já é cadastrado receber, numa segunda contratação, exatamente o
 * login do cadastro antigo. Como a solicitação guarda esse login antes de o
 * cadastro novo existir, a cobrança do serviço acabava lançada no cadastro
 * antigo — e não no que estava sendo criado.
 *
 * Por isso o login é reservado (conferido contra o MKAuth) já no momento em que
 * é gerado, e não só na hora de salvar o cadastro.
 */

/** Normaliza um nome para o formato de login do MKAuth. */
export function loginBaseDoNome(nome: string): string {
  return String(nome || "")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();
}

/**
 * Devolve um login que ainda não existe no MKAuth, sufixando quando preciso
 * (JOAOSILVA → JOAOSILVA2 → JOAOSILVA3...). O sufixo é sequencial de propósito:
 * fica leg��vel para quem atende, ao contrário de um número aleatório.
 *
 * Se o banco estiver fora, devolve a base — quem chama continua protegido pela
 * verificação de unicidade feita na hora de gravar o cadastro.
 */
export async function reservarLoginUnico(base: string): Promise<string> {
  const raiz = loginBaseDoNome(base);
  if (!raiz) return raiz;

  try {
    const repo = MkauthDataSource.getRepository(ClientesEntities);
    let candidato = raiz;
    for (let tentativa = 2; tentativa < 60; tentativa++) {
      const existe = await repo.findOne({
        where: { login: candidato },
        select: { login: true },
      });
      if (!existe) return candidato;
      candidato = `${raiz}${tentativa}`;
    }
    // Improvável (60 cadastros com o mesmo nome), mas não pode devolver um
    // login ocupado: cai para um sufixo com o horário.
    return `${raiz}${Date.now().toString().slice(-6)}`;
  } catch (e: any) {
    console.error(
      "[loginCliente] Falha ao reservar login único:",
      e?.message || e,
    );
    return raiz;
  }
}
