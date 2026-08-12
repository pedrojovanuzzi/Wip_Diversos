import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateServiceLinksTable1782800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "service_links",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          { name: "token", type: "varchar", length: "64", isUnique: true },
          { name: "servico", type: "varchar", length: "64" },
          {
            name: "login_cliente",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
          { name: "cpf", type: "varchar", length: "32", isNullable: true },
          {
            name: "nome_cliente",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
          {
            name: "status",
            type: "varchar",
            length: "32",
            default: "'pendente'",
          },
          { name: "expira_em", type: "timestamp", isNullable: true },
          { name: "aberto_em", type: "timestamp", isNullable: true },
          { name: "concluido_em", type: "timestamp", isNullable: true },
          { name: "tentativas", type: "int", default: 0 },
          {
            name: "criado_por",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
          {
            name: "observacao",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
          { name: "dados", type: "json", isNullable: true },
          { name: "resultado", type: "json", isNullable: true },
          {
            name: "criado_em",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("service_links");
  }
}
