import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddLoginToDeclaracaoQuitacao1779500000001
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("declaracao_quitacao");
    if (!table) return;
    const hasLogin = table.columns.find((c) => c.name === "login");
    if (!hasLogin) {
      await queryRunner.addColumn(
        "declaracao_quitacao",
        new TableColumn({
          name: "login",
          type: "varchar",
          length: "100",
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("declaracao_quitacao");
    if (!table) return;
    const hasLogin = table.columns.find((c) => c.name === "login");
    if (hasLogin) {
      await queryRunner.dropColumn("declaracao_quitacao", "login");
    }
  }
}
