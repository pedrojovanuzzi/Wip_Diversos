import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class NFEstatus1765809907195 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    queryRunner.addColumn(
      "nfse",
      new TableColumn({
        name: "status",
        type: "varchar",
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    queryRunner.dropColumn("nfse", "status");
  }
}
