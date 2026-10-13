import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Cobrança avulsa de licença.
 *
 * A mensalidade do mês continua uma por licença e competência, mas a avulsa
 * precisa existir junto dela. Por isso o índice deixa de ser único e quem
 * evita duplicar a mensalidade do mês é a geração, que ignora as avulsas.
 */
export class LicencaMensalidadeAvulsa1785400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const colunas = (await queryRunner.query(
      "SHOW COLUMNS FROM `licenca_mensalidades`",
    )) as { Field: string }[];

    if (!colunas.some((c) => c.Field === "avulsa")) {
      await queryRunner.query(
        "ALTER TABLE `licenca_mensalidades` ADD COLUMN `avulsa` TINYINT NOT NULL DEFAULT 0 AFTER `competencia`",
      );
    }

    const indices = (await queryRunner.query(
      "SHOW INDEX FROM `licenca_mensalidades`",
    )) as { Key_name: string }[];
    const nomes = new Set(indices.map((i) => i.Key_name));

    // Cria o novo antes de soltar o único, para a busca por licença e
    // competência nunca ficar sem índice.
    if (!nomes.has("idx_licenca_mensalidades_licenca_competencia")) {
      await queryRunner.query(
        "ALTER TABLE `licenca_mensalidades` ADD KEY `idx_licenca_mensalidades_licenca_competencia` (`licenca_id`, `competencia`)",
      );
    }
    if (nomes.has("uq_licenca_mensalidades_licenca_competencia")) {
      await queryRunner.query(
        "ALTER TABLE `licenca_mensalidades` DROP INDEX `uq_licenca_mensalidades_licenca_competencia`",
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Volta a ser única só a mensalidade do mês: as avulsas somem antes.
    await queryRunner.query(
      "DELETE FROM `licenca_mensalidades` WHERE `avulsa` = 1",
    );
    await queryRunner.query(
      "ALTER TABLE `licenca_mensalidades` ADD UNIQUE KEY `uq_licenca_mensalidades_licenca_competencia` (`licenca_id`, `competencia`)",
    );
    await queryRunner.query(
      "ALTER TABLE `licenca_mensalidades` DROP INDEX `idx_licenca_mensalidades_licenca_competencia`",
    );
    await queryRunner.query(
      "ALTER TABLE `licenca_mensalidades` DROP COLUMN `avulsa`",
    );
  }
}
