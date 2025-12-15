import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class NFEambiente1765808566669 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "nfse",
      new TableColumn({
        name: "ambiente",
        type: "varchar",
        length: "20",
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("nfse", "ambiente");
  }
}
