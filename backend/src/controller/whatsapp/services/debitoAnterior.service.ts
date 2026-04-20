import MkauthDataSource from "../../../database/MkauthSource";
import { ClientesEntities } from "../../../entities/ClientesEntities";
import { Faturas } from "../../../entities/Faturas";

export interface ContaComDebito {
  login: string;
  nome: string;
  totalFaturas: number;
  valorTotal: number;
}

export interface DebitoAnteriorResult {
  temDebito: boolean;
  contas: ContaComDebito[];
}

export async function verificarDebitosClienteDesativado(
  cpf: string,
): Promise<DebitoAnteriorResult> {
  try {
    const cpfLimpo = (cpf || "").replace(/\D/g, "");
    if (!cpfLimpo) return { temDebito: false, contas: [] };

    const clienteRepo = MkauthDataSource.getRepository(ClientesEntities);
    const faturasRepo = MkauthDataSource.getRepository(Faturas);

    const candidatos = await clienteRepo
      .createQueryBuilder("c")
      .where("c.cli_ativado = :inativo", { inativo: "n" })
      .andWhere(
        "REPLACE(REPLACE(REPLACE(REPLACE(c.cpf_cnpj, '.', ''), '-', ''), '/', ''), ' ', '') = :cpf",
        { cpf: cpfLimpo },
      )
      .getMany();

    if (!candidatos.length) return { temDebito: false, contas: [] };

    const contas: ContaComDebito[] = [];

    for (const cliente of candidatos) {
      const faturas = await faturasRepo
        .createQueryBuilder("f")
        .where("f.login = :login", { login: cliente.login })
        .andWhere("f.status = :status", { status: "vencido" })
        .getMany();

      if (faturas.length > 0) {
        const valorTotal = faturas.reduce(
          (sum, f) => sum + parseFloat(f.valor || "0"),
          0,
        );

        contas.push({
          login: cliente.login,
          nome: cliente.nome || "—",
          totalFaturas: faturas.length,
          valorTotal: Math.round(valorTotal * 100) / 100,
        });
      }
    }

    return { temDebito: contas.length > 0, contas };
  } catch (err) {
    console.error("[DebitoAnterior] Erro ao verificar débitos anteriores:", err);
    return { temDebito: false, contas: [] };
  }
}
