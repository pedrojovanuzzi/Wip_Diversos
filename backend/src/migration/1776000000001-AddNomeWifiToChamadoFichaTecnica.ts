import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddNomeWifiToChamadoFichaTecnica1776000000001
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "chamados_ficha_tecnica",
      new TableColumn({
        name: "nome_wifi",
        type: "varchar",
        length: "255",
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("chamados_ficha_tecnica", "nome_wifi");
  }
}
