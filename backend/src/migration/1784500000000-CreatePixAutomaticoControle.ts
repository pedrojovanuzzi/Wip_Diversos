import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Controle do Pix Automático: espelho das cobranças (para não dar baixa duas
 * vezes e para a conferência diária saber o que falta) e registro das
 * notificações recebidas da Efí.
 */
export class CreatePixAutomaticoControle1784500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`pix_automatico_cobrancas\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`txid\` VARCHAR(64) NOT NULL,
        \`id_rec\` VARCHAR(64) NOT NULL,
        \`login\` VARCHAR(120) NULL,
        \`titulo_fatura\` INT NULL,
        \`valor\` DECIMAL(10,2) NULL,
        \`vencimento\` DATE NULL,
        \`status\` VARCHAR(30) NULL,
        \`end_to_end_id\` VARCHAR(40) NULL,
        \`valor_pago\` DECIMAL(10,2) NULL,
        \`pago_em\` DATETIME NULL,
        \`baixado_em\` DATETIME NULL,
        \`erro\` TEXT NULL,
        \`criado_em\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`atualizado_em\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_pix_automatico_cobrancas_txid\` (\`txid\`),
        KEY \`idx_pix_automatico_cobrancas_rec\` (\`id_rec\`),
        KEY \`idx_pix_automatico_cobrancas_login\` (\`login\`, \`vencimento\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`pix_automatico_notificacoes\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`origem\` VARCHAR(10) NOT NULL,
        \`payload\` TEXT NOT NULL,
        \`processada\` TINYINT(1) NOT NULL DEFAULT 0,
        \`erro\` TEXT NULL,
        \`criado_em\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_pix_automatico_notificacoes_pendentes\` (\`processada\`, \`criado_em\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DROP TABLE IF EXISTS `pix_automatico_notificacoes`",
    );
    await queryRunner.query("DROP TABLE IF EXISTS `pix_automatico_cobrancas`");
  }
}
