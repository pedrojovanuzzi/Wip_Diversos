import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/**
 * Adiciona `http_port` em `cameras`: porta HTTP da câmera (eventos de movimento
 * + configuração via CGI). Padrão 80; câmeras com IP público/port-forward
 * costumam expor o HTTP em outra porta.
 */
export class AddHttpPortToCameras1780900000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("cameras");
    if (table && !table.findColumnByName("http_port")) {
      await queryRunner.addColumn(
        "cameras",
        new TableColumn({
          name: "http_port",
          type: "int",
          isNullable: false,
          default: 80,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("cameras");
    if (table && table.findColumnByName("http_port")) {
      await queryRunner.dropColumn("cameras", "http_port");
    }
  }
}
