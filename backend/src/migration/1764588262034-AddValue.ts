import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddValue1764588262034 implements MigrationInterface {
  name = "AddValue1764588262034";
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "nfcom",
      new TableColumn({
        name: "value",
        type: "decimal",
        precision: 10,
        scale: 2,
        default: 0,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("nfcom", "value");
  }
}
