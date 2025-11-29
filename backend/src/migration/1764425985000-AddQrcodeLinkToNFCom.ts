import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddQrcodeLinkToNFCom1764425985000 implements MigrationInterface {
  name = "AddQrcodeLinkToNFCom1764425985000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "nfcom",
      new TableColumn({
        name: "qrcodeLink",
        type: "varchar",
        length: "255",
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("nfcom", "qrcodeLink");
  }
}
