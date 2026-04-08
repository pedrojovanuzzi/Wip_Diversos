/**
 * Script de correção: fecha chamados no MKAuth que estão como "aberto"
 * mas cuja solicitação já está finalizada (finalizado = 1).
 *
 * Executar: npx tsx src/scripts/fix-chamados-abertos.ts
 */

import "dotenv/config";
import AppDataSource from "../database/DataSource";
import MkauthSource from "../database/MkauthSource";
import { SolicitacaoServico } from "../entities/SolicitacaoServico";
import { ChamadosEntities } from "../entities/ChamadosEntities";
import { In } from "typeorm";

async function main() {
  await AppDataSource.initialize();
  await MkauthSource.initialize();

  // Busca todas as solicitações finalizadas com id_chamado
  const solicitacoes = await AppDataSource.getRepository(SolicitacaoServico).find({
    where: { finalizado: true },
    select: { id: true, id_chamado: true },
  });

  const chamadoIds = solicitacoes
    .map((s) => s.id_chamado)
    .filter(Boolean) as string[];

  if (chamadoIds.length === 0) {
    console.log("Nenhuma solicitação finalizada com chamado encontrada.");
    return;
  }

  console.log(`Encontradas ${chamadoIds.length} solicitações finalizadas com chamado.`);

  const mkRepo = MkauthSource.getRepository(ChamadosEntities);

  // Busca chamados que ainda estão "aberto"
  const chamadosAbertos = await mkRepo.find({
    where: {
      chamado: In(chamadoIds),
      status: "aberto",
    },
    select: { chamado: true, status: true },
  });

  if (chamadosAbertos.length === 0) {
    console.log("Nenhum chamado aberto para corrigir.");
    return;
  }

  console.log(`Corrigindo ${chamadosAbertos.length} chamados de "aberto" para "fechado"...`);

  for (const chamado of chamadosAbertos) {
    chamado.status = "fechado";
    await mkRepo.save(chamado);
    console.log(`  ✔ Chamado ${chamado.chamado} → fechado`);
  }

  console.log("Concluído.");
}

main()
  .catch((err) => {
    console.error("Erro:", err);
    process.exit(1);
  })
  .finally(async () => {
    await AppDataSource.destroy().catch(() => {});
    await MkauthSource.destroy().catch(() => {});
  });
