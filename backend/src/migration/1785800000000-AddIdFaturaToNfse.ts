import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Liga a NFS-e à fatura que a originou. Sem isso, a tela de emissão só sabia
 * "este cliente já tem nota neste mês", e a nota de um serviço avulso sumia
 * quando a da mensalidade já tinha saído (e vice-versa).
 */
export class AddIdFaturaToNfse1785800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const colunas = (await queryRunner.query(
      "SHOW COLUMNS FROM `nfse`",
    )) as { Field: string }[];

    if (colunas.some((c) => c.Field === "id_fatura")) return;

    await queryRunner.query(
      "ALTER TABLE `nfse` ADD COLUMN `id_fatura` INT NULL, ADD INDEX `idx_nfse_id_fatura` (`id_fatura`)",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `nfse` DROP INDEX `idx_nfse_id_fatura`, DROP COLUMN `id_fatura`",
    );
  }
}
