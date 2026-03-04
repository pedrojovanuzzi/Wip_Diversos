/**
 * Backfill Script: Populate `endereco` and `equipamentos` for existing NFEs.
 *
 * Run with:
 *   npx tsx src/migration/backfill-nfe-data.ts
 */

import "reflect-metadata";
import path from "path";
import dotenv from "dotenv";
import { XMLParser } from "fast-xml-parser";
import AppDataSource from "./database/DataSource";
import { NFE } from "./entities/NFE";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseTagValue: false,
});

function extractEnderecoFromXml(xml: string): string | null {
  try {
    const parsed = parser.parse(xml);
    const root = parsed.nfeProc?.NFe || parsed.NFe;
    const enderDest = root?.infNFe?.dest?.enderDest;
    if (!enderDest) return null;
    const xLgr = enderDest.xLgr?.toString().trim() || "";
    const nro = enderDest.nro?.toString().trim() || "";
    if (!xLgr) return null;
    return `${xLgr}, ${nro}`.trim().replace(/,\s*$/, "");
  } catch {
    return null;
  }
}

function extractEquipamentosFromXml(xml: string): string[] | null {
  try {
    const parsed = parser.parse(xml);
    const root = parsed.nfeProc?.NFe || parsed.NFe;
    const det = root?.infNFe?.det;
    if (!det) return null;
    const items = Array.isArray(det) ? det : [det];
    return items
      .map((item: any) => item?.prod?.xProd?.toString().trim())
      .filter(Boolean);
  } catch {
    return null;
  }
}

async function main() {
  await AppDataSource.initialize();
  console.log("✅ Conexão com banco de dados estabelecida.");

  const nfeRepo = AppDataSource.getRepository(NFE);

  let skip = 0;
  const batchSize = 500;
  let totalUpdated = 0;
  let totalSkipped = 0;

  while (true) {
    const records = await nfeRepo.find({
      select: ["id", "xml", "endereco", "equipamentos"],
      skip,
      take: batchSize,
    });

    if (records.length === 0) break;

    for (const record of records) {
      // Skip if already populated and XML hasn't changed — optional, remove to force re-populate
      if (record.endereco && record.equipamentos) {
        totalSkipped++;
        continue;
      }

      const endereco = record.xml ? extractEnderecoFromXml(record.xml) : null;
      const equipamentos = record.xml
        ? extractEquipamentosFromXml(record.xml)
        : null;

      await nfeRepo.update(record.id, {
        endereco: endereco ?? undefined,
        equipamentos: equipamentos ?? undefined,
      });

      totalUpdated++;
    }

    console.log(
      `  Processados ${skip + records.length} registros... (${totalUpdated} atualizados, ${totalSkipped} pulados)`,
    );
    skip += batchSize;

    if (records.length < batchSize) break;
  }

  console.log(`\n✅ Backfill concluído!`);
  console.log(`   Atualizados: ${totalUpdated}`);
  console.log(`   Já preenchidos / pulados: ${totalSkipped}`);

  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error("Erro no backfill:", err);
  process.exit(1);
});
