import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class NFComMigration1764419888000 implements MigrationInterface {
  name = "NFComMigration1764419888000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "nfcom",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          {
            name: "nNF",
            type: "varchar",
            length: "20",
          },
          {
            name: "serie",
            type: "varchar",
            length: "5",
          },
          {
            name: "chave",
            type: "varchar",
            length: "44",
            isUnique: true,
          },
          {
            name: "xml",
            type: "longtext",
          },
          {
            name: "protocolo",
            type: "varchar",
            length: "50",
            isNullable: true,
          },
          {
            name: "status",
            type: "varchar",
            length: "20",
            default: "'autorizada'",
          },
          {
            name: "data_emissao",
            type: "datetime",
          },
          {
            name: "cliente_id",
            type: "int",
            isNullable: true,
          },
          {
            name: "fatura_id",
            type: "int",
            isNullable: true,
          },
        ],
      }),
      true
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("nfcom");
  }
}
