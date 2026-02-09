import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddTipoToNFE1770000000004 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "nfe",
      new TableColumn({
        name: "tipo",
        type: "varchar",
        length: "20",
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("nfe", "tipo");
  }
}
