import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class NFEnumber1765893227364 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "nfse",
      new TableColumn({
        name: "numeroNfe",
        type: "int",
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("nfse", "numeroNfe");
  }
}
