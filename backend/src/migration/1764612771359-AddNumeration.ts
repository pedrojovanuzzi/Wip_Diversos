import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddNumeration1764612771359 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "nfcom",
      new TableColumn({
        name: "numeracao",
        type: "int",
        isNullable: false,
        default: 1,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("nfcom", "numeracao");
  }
}
