import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddObservacaoToNFE1771400000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "nfe",
      new TableColumn({
        name: "observacao",
        type: "text",
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("nfe", "observacao");
  }
}
