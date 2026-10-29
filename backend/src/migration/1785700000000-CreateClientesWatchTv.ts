import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Coluna única dizendo se o cliente tem a Watch TV (1) ou não (0). A carga
 * inicial é feita pela sincronização que roda ao subir o servidor: a origem
 * dos dados está no banco do MK-Auth, que esta migration não enxerga.
 */
export class CreateClientesWatchTv1785700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`clientes_watchtv\` (
        \`login\` VARCHAR(100) NOT NULL,
        \`watchtv\` TINYINT(1) NOT NULL DEFAULT 0,
        \`origem\` VARCHAR(20) NULL,
        \`atualizado_em\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`login\`),
        KEY \`idx_clientes_watchtv_watchtv\` (\`watchtv\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS `clientes_watchtv`");
  }
}
