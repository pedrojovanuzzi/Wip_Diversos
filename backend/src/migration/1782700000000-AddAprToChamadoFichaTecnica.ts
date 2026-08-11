import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddAprToChamadoFichaTecnica1782700000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns("chamados_ficha_tecnica", [
      new TableColumn({
        name: "apr",
        type: "json",
        isNullable: true,
      }),
      new TableColumn({
        name: "apr_assinatura_base64",
        type: "longtext",
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns("chamados_ficha_tecnica", [
      "apr",
      "apr_assinatura_base64",
    ]);
  }
}
