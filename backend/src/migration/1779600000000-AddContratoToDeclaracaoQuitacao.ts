import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddContratoToDeclaracaoQuitacao1779600000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("declaracao_quitacao");
    if (!table) return;
    const hasColumn = table.columns.some((c) => c.name === "contrato");
    if (!hasColumn) {
      await queryRunner.addColumn(
        "declaracao_quitacao",
        new TableColumn({
          name: "contrato",
          type: "varchar",
          length: "255",
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("declaracao_quitacao");
    if (!table) return;
    const hasColumn = table.columns.some((c) => c.name === "contrato");
    if (hasColumn) {
      await queryRunner.dropColumn("declaracao_quitacao", "contrato");
    }
  }
}
