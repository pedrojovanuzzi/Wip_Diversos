import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Mensalidades das licenças de software: a regra por software e as
 * mensalidades geradas. Não encosta no MKAuth — mensalidade de internet
 * continua só em `sis_lanc`.
 */
export class CreateLicencaMensalidades1784600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`licenca_mensalidade_configs\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`software\` VARCHAR(255) NOT NULL,
        \`dia_vencimento\` INT NOT NULL DEFAULT 10,
        \`gerar_todo_mes\` TINYINT(1) NOT NULL DEFAULT 1,
        \`valor\` DECIMAL(10,2) NOT NULL DEFAULT 0,
        \`ativo\` TINYINT(1) NOT NULL DEFAULT 1,
        \`observacao\` TEXT NULL,
        \`criado_em\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`atualizado_em\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_licenca_mensalidade_configs_software\` (\`software\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`licenca_mensalidades\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`licenca_id\` INT NOT NULL,
        \`software\` VARCHAR(255) NULL,
        \`cliente_nome\` VARCHAR(255) NULL,
        \`competencia\` VARCHAR(7) NOT NULL,
        \`vencimento\` DATE NOT NULL,
        \`valor\` DECIMAL(10,2) NOT NULL,
        \`status\` VARCHAR(20) NOT NULL DEFAULT 'aberta',
        \`txid\` VARCHAR(64) NULL,
        \`pix_copia_cola\` TEXT NULL,
        \`pix_link\` VARCHAR(255) NULL,
        \`valor_pago\` DECIMAL(10,2) NULL,
        \`pago_em\` DATETIME NULL,
        \`end_to_end_id\` VARCHAR(40) NULL,
        \`forma_pagamento\` VARCHAR(30) NULL,
        \`observacao\` TEXT NULL,
        \`criado_em\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`atualizado_em\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_licenca_mensalidades_licenca_competencia\` (\`licenca_id\`, \`competencia\`),
        KEY \`idx_licenca_mensalidades_txid\` (\`txid\`),
        KEY \`idx_licenca_mensalidades_status\` (\`status\`, \`vencimento\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS `licenca_mensalidades`");
    await queryRunner.query(
      "DROP TABLE IF EXISTS `licenca_mensalidade_configs`",
    );
  }
}
