import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/**
 * Adiciona `record_latch` em `cameras`: segundos que o MediaMTX continua gravando
 * DEPOIS que o movimento para (o "rabo" da gravação por movimento). 0 = para
 * imediatamente. Default 8 (mantém o comportamento anterior, que era fixo).
 */
export class AddRecordLatchToCameras1780900000005 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("cameras");
    if (table && !table.findColumnByName("record_latch")) {
      await queryRunner.addColumn(
        "cameras",
        new TableColumn({
          name: "record_latch",
          type: "int",
          isNullable: false,
          default: 8,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("cameras");
    if (table && table.findColumnByName("record_latch")) {
      await queryRunner.dropColumn("cameras", "record_latch");
    }
  }
}
