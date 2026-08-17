import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddComandoClientesToServidoresAcesso1783500000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "servidores_acesso",
      new TableColumn({
        name: "comando_clientes",
        type: "varchar",
        length: "255",
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("servidores_acesso", "comando_clientes");
  }
}
