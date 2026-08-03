import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddRedeSecundariaToChamadoFichaTecnica1776000000002
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns("chamados_ficha_tecnica", [
      new TableColumn({
        name: "nome_wifi_secundario",
        type: "varchar",
        length: "255",
        isNullable: true,
      }),
      new TableColumn({
        name: "senha_wifi_secundario",
        type: "varchar",
        length: "255",
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns("chamados_ficha_tecnica", [
      "nome_wifi_secundario",
      "senha_wifi_secundario",
    ]);
  }
}
