import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Contas da TV WIP grátis. Fica no banco do sistema (wip_diversos), separada
 * do streaming pago da Watch Brasil — são produtos diferentes.
 */
export class CreateTvWipContas1783900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`tv_wip_contas\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`login\` VARCHAR(100) NOT NULL,
        \`senha\` VARCHAR(255) NULL,
        \`nome\` VARCHAR(255) NULL,
        \`ativo\` TINYINT(1) NOT NULL DEFAULT 1,
        \`desativado_em\` DATETIME NULL,
        \`motivo_desativacao\` VARCHAR(255) NULL,
        \`desativado_por\` VARCHAR(100) NULL,
        \`verificado_em\` DATETIME NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_tv_wip_contas_login\` (\`login\`),
        KEY \`idx_tv_wip_contas_ativo\` (\`ativo\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS `tv_wip_contas`");
  }
}
