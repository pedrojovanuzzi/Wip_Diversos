import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from "typeorm";

export class AddSolicitacaoIdToServiceLinks1782900000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "service_links",
      new TableColumn({
        name: "solicitacao_id",
        type: "int",
        isNullable: true,
      }),
    );

    await queryRunner.createIndex(
      "service_links",
      new TableIndex({
        name: "IDX_service_links_solicitacao_id",
        columnNames: ["solicitacao_id"],
      }),
    );

    // Backfill: até agora o vínculo só existia dentro do JSON de resultado.
    await queryRunner.query(
      `UPDATE service_links
         SET solicitacao_id = JSON_EXTRACT(resultado, '$.solicitacao_id')
       WHERE resultado IS NOT NULL
         AND JSON_EXTRACT(resultado, '$.solicitacao_id') IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      "service_links",
      "IDX_service_links_solicitacao_id",
    );
    await queryRunner.dropColumn("service_links", "solicitacao_id");
  }
}
