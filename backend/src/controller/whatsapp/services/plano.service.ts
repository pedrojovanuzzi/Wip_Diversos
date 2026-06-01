import { Like } from "typeorm";
import { SisPlano } from "../../../entities/SisPlano";
import MkauthDataSource from "../../../database/MkauthSource";

export async function getPlanosDoSistema() {
  try {
    const planoRepository = MkauthDataSource.getRepository(SisPlano);
    const planos = await planoRepository
      .createQueryBuilder("p")
      .where("p.nome LIKE :prefix ESCAPE '\\\\'", { prefix: "\\_%" })
      .andWhere("p.nome NOT LIKE :est ESCAPE '\\\\'", { est: "\\_EST%" })
      .orderBy("p.nome", "ASC")
      .getMany();

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

export async function getPlanosWifiExtendido() {
  try {
    const planoRepository = MkauthDataSource.getRepository(SisPlano);
    const planos = await planoRepository.find({
      where: { nome: Like("\\_EST\\_WIFI%") },
      order: { nome: "ASC" },
    });

    console.log(
      `🔍 [getPlanosWifiExtendido] ${planos.length} planos encontrados.`,
    );

    return planos.map((p) => ({
      id: p.nome,
      title: `${p.nome.replace(/_/g, " ").trim()} - R$ ${Number((p.valor || "0").replace(",", ".")).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
    }));
  } catch (error: any) {
    console.error("❌ [getPlanosWifiExtendido] Erro ao buscar planos:", error);
    return [];
  }
}
