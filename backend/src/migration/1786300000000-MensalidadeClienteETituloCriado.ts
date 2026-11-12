import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Interruptor "boleto automático" por cliente (entities/MensalidadeCliente.ts)
 * e o registro das mensalidades criadas para isentos
 * (entities/MensalidadeTituloCriado.ts).
 */
export class MensalidadeClienteETituloCriado1786300000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`mensalidade_cliente\` (
        \`login\` VARCHAR(64) NOT NULL,
        \`automatico\` TINYINT NOT NULL DEFAULT 0,
        \`atualizado_por\` VARCHAR(100) NULL,
        \`atualizado_em\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
          ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`login\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`mensalidade_titulo_criado\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`login\` VARCHAR(64) NOT NULL,
        \`competencia\` VARCHAR(7) NOT NULL,
        \`titulo_id\` INT NULL,
        \`vencimento\` DATE NOT NULL,
        \`valor\` DECIMAL(12,2) NOT NULL,
        \`criado_em\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE INDEX \`uq_mensalidade_titulo_criado\` (\`login\`, \`competencia\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS `mensalidade_titulo_criado`");
    await queryRunner.query("DROP TABLE IF EXISTS `mensalidade_cliente`");
  }
}
