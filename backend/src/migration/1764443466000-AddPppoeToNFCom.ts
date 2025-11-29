import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddPppoeToNFCom1764443466000 implements MigrationInterface {
  name = "AddPppoeToNFCom1764443466000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "nfcom",
      new TableColumn({
        name: "pppoe",
        type: "varchar",
        length: "255",
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("nfcom", "pppoe");
  }
}
