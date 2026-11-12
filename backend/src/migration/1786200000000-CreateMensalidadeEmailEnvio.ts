import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Lembretes de boleto por e-mail da tela Mensalidades
 * (entities/MensalidadeEmailEnvio.ts).
 */
export class CreateMensalidadeEmailEnvio1786200000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`mensalidade_email_envio\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`titulo_id\` INT NOT NULL,
        \`login_cliente\` VARCHAR(64) NOT NULL,
        \`dias_antes\` INT NOT NULL,
        \`vencimento\` DATE NOT NULL,
        \`email\` VARCHAR(255) NULL,
        \`situacao\` VARCHAR(16) NOT NULL,
        \`tentativas\` INT NOT NULL DEFAULT 1,
        \`charge_id\` BIGINT NULL,
        \`com_pdf\` TINYINT NOT NULL DEFAULT 0,
        \`erro\` TEXT NULL,
        \`criado_em\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`atualizado_em\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
          ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`uq_mensalidade_email_envio\` (\`titulo_id\`, \`dias_antes\`, \`vencimento\`),
        INDEX \`idx_mensalidade_email_envio_login\` (\`login_cliente\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS `mensalidade_email_envio`");
  }
}
