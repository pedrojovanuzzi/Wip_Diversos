import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Links para o cliente criar (ou refazer) a própria conta da Watch TV. Antes o
 * atendente digitava o e-mail e a Watch Brasil recusava quando ele já estava
 * em uso, deixando o serviço cobrado e sem acesso.
 */
export class CreateStreamingConvites1785600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`streaming_convites\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`token\` VARCHAR(64) NOT NULL,
        \`login\` VARCHAR(100) NOT NULL,
        \`solicitacao_id\` INT NULL,
        \`criado_por\` VARCHAR(100) NULL,
        \`expira_em\` DATETIME NOT NULL,
        \`usado_em\` DATETIME NULL,
        \`email_usado\` VARCHAR(255) NULL,
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`idx_streaming_convites_token\` (\`token\`),
        KEY \`idx_streaming_convites_login\` (\`login\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS `streaming_convites`");
  }
}
