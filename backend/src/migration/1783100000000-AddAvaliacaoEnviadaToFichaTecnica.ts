import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddAvaliacaoEnviadaToFichaTecnica1783100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "chamados_ficha_tecnica",
      new TableColumn({
        name: "avaliacao_enviada_em",
        type: "timestamp",
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn(
      "chamados_ficha_tecnica",
      "avaliacao_enviada_em",
    );
  }
}
