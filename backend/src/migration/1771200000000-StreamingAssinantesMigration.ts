import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class StreamingAssinantesMigration1771200000000
  implements MigrationInterface
{
  name = "StreamingAssinantesMigration1771200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "streaming_assinantes",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          {
            name: "login",
            type: "varchar",
            length: "100",
            isUnique: true,
          },
          {
            name: "email",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
          {
            name: "phone",
            type: "varchar",
            length: "30",
            isNullable: true,
          },
          {
            name: "pacote",
            type: "varchar",
            length: "100",
            isNullable: true,
          },
          {
            name: "ticket",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
          {
            name: "assinante_id_integracao",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
          {
            name: "ativo",
            type: "tinyint",
            width: 1,
            default: 1,
          },
          {
            name: "last_response",
            type: "text",
            isNullable: true,
          },
          {
            name: "created_at",
            type: "datetime",
            default: "CURRENT_TIMESTAMP",
          },
          {
            name: "updated_at",
            type: "datetime",
            default: "CURRENT_TIMESTAMP",
            onUpdate: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("streaming_assinantes");
  }
}
