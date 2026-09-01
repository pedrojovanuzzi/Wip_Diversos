import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Coleta mensal CODEF (Anatel): o de-para do plano de contas e os valores que
 * não existem no MKAuth (dívida e caixa). Ficam no banco do sistema
 * (wip_diversos); o MKAuth é só lido.
 */
export class CreateCodefTables1784000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`codef_plano_contas\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`plano_contas\` VARCHAR(255) NOT NULL,
        \`historico_contem\` VARCHAR(255) NULL,
        \`categoria\` VARCHAR(32) NOT NULL,
        \`definido_por\` VARCHAR(100) NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_codef_plano_contas_plano\` (\`plano_contas\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`codef_competencias\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`ano\` INT NOT NULL,
        \`mes\` INT NOT NULL,
        \`emprestimos\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`caixa\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`descontos\` DECIMAL(14,2) NOT NULL DEFAULT 0.00,
        \`observacao\` VARCHAR(500) NULL,
        \`informado_por\` VARCHAR(100) NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_codef_competencias\` (\`ano\`, \`mes\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS `codef_competencias`");
    await queryRunner.query("DROP TABLE IF EXISTS `codef_plano_contas`");
  }
}
