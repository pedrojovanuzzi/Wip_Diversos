import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddTesteExpiraEmToStreamingAssinantes1783700000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "streaming_assinantes",
      new TableColumn({
        name: "teste_expira_em",
        type: "timestamp",
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("streaming_assinantes", "teste_expira_em");
  }
}
