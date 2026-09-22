import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/** Testes de velocidade (download/upload em Mbps) da ficha do chamado. */
export class AddTestesToChamadoFichaTecnica1785000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tabela = await queryRunner.getTable("chamados_ficha_tecnica");
    if (tabela?.findColumnByName("testes")) return;

    await queryRunner.addColumn(
      "chamados_ficha_tecnica",
      new TableColumn({
        name: "testes",
        type: "json",
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("chamados_ficha_tecnica", "testes");
  }
}
