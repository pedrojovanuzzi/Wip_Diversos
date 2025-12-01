import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class OptionHomologacaoProducao1764596619198
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "nfcom",
      new TableColumn({
        name: "tpAmb",
        type: "int",
        isNullable: true,
        default: 1,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("nfcom", "tpAmb");
  }
}
