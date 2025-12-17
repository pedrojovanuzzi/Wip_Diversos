import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class NFEstatus1765810449608 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "nfse",
      new TableColumn({
        name: "status",
        type: "varchar",
        length: "20",
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("nfse", "status");
  }
}
