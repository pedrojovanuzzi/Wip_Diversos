import { Like } from "typeorm";
import { SisPlano } from "../../../entities/SisPlano";
import MkauthDataSource from "../../../database/MkauthSource";

/**
 * Planos que podem ser contratados pelo bot e pelo site.
 *
 * O cadastro do MKAuth guarda tudo na mesma tabela: link dedicado, multa
 * contratual, plano de bloqueio, planos de teste. A convenção da casa é o
 * underscore inicial marcar o que é de venda.
 *
 * `_EST` fica de fora porque é wifi estendido: tem lista própria
 * (getPlanosWifiExtendido) e não é contratado sozinho.
 */
const PREFIXO_DE_VENDA = "\\_";

/**
 * Planos oferecidos que fogem da convenção do underscore, liberados um a um.
 *
 * Vai por nome exato, e não por prefixo `COMBO_`: o cadastro tem outros combos
 * (400M e 600M) que existem mas não são vendidos — um prefixo colocaria os três
 * na tela. Para oferecer outro, basta acrescentar o nome aqui.
 */
const PLANOS_LIBERADOS = ["COMBO_800M_STREAMING"];

export async function getPlanosDoSistema() {
  try {
    const planoRepository = MkauthDataSource.getRepository(SisPlano);
    const planos = await planoRepository
      .createQueryBuilder("p")
      .where(
        // Os parênteses são obrigatórios: sem eles o SQL vira
        // `A OR B AND NOT _EST`, e o AND se aplicaria só à última condição —
        // o wifi estendido voltava para a lista pela primeira.
        PLANOS_LIBERADOS.length
          ? `(p.nome LIKE :prefixo ESCAPE '\\\\' OR p.nome IN (:...liberados))`
          : `p.nome LIKE :prefixo ESCAPE '\\\\'`,
        { prefixo: `${PREFIXO_DE_VENDA}%`, liberados: PLANOS_LIBERADOS },
      )
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
