import { Like } from "typeorm";
import { SisPlano } from "../../../entities/SisPlano";
import MkauthDataSource from "../../../database/MkauthSource";

export async function getPlanosDoSistema() {
  try {
    const planoRepository = MkauthDataSource.getRepository(SisPlano);
    const planos = await planoRepository.find({
      where: { nome: Like("\\_%") },
      order: { nome: "ASC" },
    });

    console.log(
      `🔍 [getPlanosDoSistema] ${planos.length} planos encontrados.`,
    );

    return planos.map((p) => ({
      id: p.nome,
      title: `${p.nome.replace(/_/g, " ").trim()} - R$ ${Number((p.valor || "0").replace(",", ".")).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    }));
  } catch (error: any) {
    console.error("❌ [getPlanosDoSistema] Erro ao buscar planos:", error);
    return [];
  }
}
