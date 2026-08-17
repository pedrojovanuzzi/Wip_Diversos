import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddFuncaoToServidoresAcesso1783600000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "servidores_acesso",
      new TableColumn({
        name: "funcao",
        type: "varchar",
        length: "16",
        default: "'pppoe'",
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("servidores_acesso", "funcao");
  }
}
