import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Engrenagem da tela Mensalidades (mensalidade_config) e a competência
 * (AAAA-MM) de cada bolix, que é o que lembra "este mês já foi pago" para a
 * geração automática não cobrar o mesmo mês duas vezes.
 */
export class MensalidadeConfigECompetencia1786100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`mensalidade_config\` (
        \`chave\` VARCHAR(64) NOT NULL,
        \`valor\` TEXT NOT NULL,
        \`atualizado_por\` VARCHAR(100) NULL,
        \`atualizado_em\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
          ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`chave\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const colunas = (await queryRunner.query(
      "SHOW COLUMNS FROM `mensalidade_bolix`",
    )) as { Field: string }[];
    if (!colunas.some((c) => c.Field === "competencia")) {
      await queryRunner.query(
        "ALTER TABLE `mensalidade_bolix` ADD COLUMN `competencia` VARCHAR(7) NULL, ADD INDEX `idx_mensalidade_bolix_competencia` (`login_cliente`, `competencia`)",
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `mensalidade_bolix` DROP INDEX `idx_mensalidade_bolix_competencia`, DROP COLUMN `competencia`",
    );
    await queryRunner.query("DROP TABLE IF EXISTS `mensalidade_config`");
  }
}
