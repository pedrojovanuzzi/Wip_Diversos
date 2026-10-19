import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreatePowerDnsConfigTable1785500000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "powerdns_config",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          { name: "host", type: "varchar", length: "128", isNullable: true },
          { name: "porta", type: "int", default: 22 },
          { name: "login", type: "varchar", length: "128", isNullable: true },
          { name: "senha", type: "text", isNullable: true },
          {
            name: "servidor_dns",
            type: "varchar",
            length: "128",
            default: "'143.255.135.34'",
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
    await queryRunner.dropTable("powerdns_config");
  }
}
