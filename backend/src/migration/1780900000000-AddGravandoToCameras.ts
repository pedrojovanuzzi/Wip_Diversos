import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/**
 * Adiciona a coluna `gravando` em `cameras` (gravação 24/7 ligada/pausada).
 * Idempotente: só cria a coluna se ela ainda não existir.
 */
export class AddGravandoToCameras1780900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("cameras");
    if (table && !table.findColumnByName("gravando")) {
      await queryRunner.addColumn(
        "cameras",
        new TableColumn({
          name: "gravando",
          type: "tinyint",
          width: 1,
          isNullable: false,
          default: 1,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("cameras");
    if (table && table.findColumnByName("gravando")) {
      await queryRunner.dropColumn("cameras", "gravando");
    }
  }
}
