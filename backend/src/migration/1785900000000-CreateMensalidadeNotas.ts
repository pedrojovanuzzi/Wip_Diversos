import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Notas dos títulos da tela Mensalidades (ver entities/MensalidadeNota.ts).
 */
export class CreateMensalidadeNotas1785900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`mensalidade_notas\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`titulo_id\` INT NOT NULL,
        \`login_cliente\` VARCHAR(64) NOT NULL,
        \`texto\` TEXT NOT NULL,
        \`usuario\` VARCHAR(100) NULL,
        \`criado_em\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        INDEX \`idx_mensalidade_notas_titulo\` (\`titulo_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS `mensalidade_notas`");
  }
}
