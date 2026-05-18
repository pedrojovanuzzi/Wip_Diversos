import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class StreamingAssinantesAddChave1779200000000
  implements MigrationInterface
{
  name = "StreamingAssinantesAddChave1779200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "streaming_assinantes",
      new TableColumn({
        name: "chave",
        type: "varchar",
        length: "100",
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("streaming_assinantes", "chave");
  }
}
