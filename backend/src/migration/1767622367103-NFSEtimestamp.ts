import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class NFSEtimestamp1767622367103 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "nfse",
      new TableColumn({
        name: "timestamp",
        type: "timestamp",
        default: "CURRENT_TIMESTAMP",
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("nfse", "timestamp");
  }
}
