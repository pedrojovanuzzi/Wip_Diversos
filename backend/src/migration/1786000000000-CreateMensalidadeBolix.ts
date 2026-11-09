import { MigrationInterface, QueryRunner } from "typeorm";

/** Bolix da Efí dos títulos da tela Mensalidades (entities/MensalidadeBolix.ts). */
export class CreateMensalidadeBolix1786000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`mensalidade_bolix\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`titulo_id\` INT NOT NULL,
        \`login_cliente\` VARCHAR(64) NOT NULL,
        \`charge_id\` BIGINT NOT NULL,
        \`situacao\` VARCHAR(16) NOT NULL DEFAULT 'ativo',
        \`valor\` DECIMAL(12,2) NOT NULL,
        \`vencimento\` DATE NOT NULL,
        \`linha_digitavel\` VARCHAR(80) NULL,
        \`pix_copia_cola\` TEXT NULL,
        \`pix_qrcode_imagem\` MEDIUMTEXT NULL,
        \`link\` VARCHAR(255) NULL,
        \`pdf\` VARCHAR(255) NULL,
        \`usuario\` VARCHAR(100) NULL,
        \`criado_em\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`pago_em\` DATETIME NULL,
        PRIMARY KEY (\`id\`),
        INDEX \`idx_mensalidade_bolix_titulo\` (\`titulo_id\`),
        UNIQUE INDEX \`idx_mensalidade_bolix_charge\` (\`charge_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS `mensalidade_bolix`");
  }
}
