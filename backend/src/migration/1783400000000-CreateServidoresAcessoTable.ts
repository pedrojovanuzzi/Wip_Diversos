import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateServidoresAcessoTable1783400000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "servidores_acesso",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          { name: "nome", type: "varchar", length: "64" },
          { name: "tipo", type: "varchar", length: "16" },
          { name: "host", type: "varchar", length: "128" },
          { name: "porta", type: "int" },
          { name: "login", type: "varchar", length: "128" },
          { name: "senha", type: "text" },
          { name: "ativo", type: "boolean", default: true },
          { name: "ordem", type: "int", default: 0 },
          {
            name: "observacao",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
          {
            name: "criado_em",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
          {
            name: "atualizado_em",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
            onUpdate: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("servidores_acesso");
  }
}
