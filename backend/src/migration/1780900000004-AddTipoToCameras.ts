import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/**
 * Adiciona `tipo` em `cameras`: marca/protocolo da câmera. Hoje a detecção de
 * movimento (CGI Dahua) só funciona em Intelbras/Dahua, então o tipo é um destes.
 * Default 'intelbras'.
 */
export class AddTipoToCameras1780900000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("cameras");
    if (table && !table.findColumnByName("tipo")) {
      await queryRunner.addColumn(
        "cameras",
        new TableColumn({
          name: "tipo",
          type: "varchar",
          length: "20",
          isNullable: false,
          default: "'intelbras'",
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("cameras");
    if (table && table.findColumnByName("tipo")) {
      await queryRunner.dropColumn("cameras", "tipo");
    }
  }
}
