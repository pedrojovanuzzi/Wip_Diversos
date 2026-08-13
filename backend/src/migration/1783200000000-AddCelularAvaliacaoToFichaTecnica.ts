import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddCelularAvaliacaoToFichaTecnica1783200000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "chamados_ficha_tecnica",
      new TableColumn({
        name: "celular_avaliacao",
        type: "varchar",
        length: "32",
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn(
      "chamados_ficha_tecnica",
      "celular_avaliacao",
    );
  }
}
