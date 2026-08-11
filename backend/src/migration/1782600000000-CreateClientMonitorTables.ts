import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class CreateClientMonitorTables1782600000000
  implements MigrationInterface
{
  name = "CreateClientMonitorTables1782600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "client_monitors",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          { name: "pppoe", type: "varchar", length: "128" },
          { name: "horas", type: "int" },
          { name: "intervalo", type: "int", default: 60 },
          { name: "status", type: "varchar", length: "20", default: "'ativo'" },
          { name: "iniciado_em", type: "timestamp" },
          { name: "expira_em", type: "timestamp" },
          { name: "finalizado_em", type: "timestamp", isNullable: true },
          { name: "ultima_verificacao", type: "timestamp", isNullable: true },
          {
            name: "criado_por",
            type: "varchar",
            length: "128",
            isNullable: true,
          },
          {
            name: "created_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      "client_monitors",
      new TableIndex({
        name: "IDX_client_monitors_pppoe_status",
        columnNames: ["pppoe", "status"],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: "client_monitor_events",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          { name: "monitor_id", type: "int" },
          { name: "pppoe", type: "varchar", length: "128" },
          { name: "tipo", type: "varchar", length: "20" },
          { name: "mudanca", type: "tinyint", width: 1, default: 0 },
          {
            name: "servidor",
            type: "varchar",
            length: "32",
            isNullable: true,
          },
          { name: "ip", type: "varchar", length: "64", isNullable: true },
          { name: "caller_id", type: "varchar", length: "64", isNullable: true },
          { name: "uptime", type: "varchar", length: "64", isNullable: true },
          { name: "download", type: "bigint", isNullable: true },
          { name: "upload", type: "bigint", isNullable: true },
          {
            name: "mensagem",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
          {
            name: "created_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      "client_monitor_events",
      new TableIndex({
        name: "IDX_client_monitor_events_monitor",
        columnNames: ["monitor_id"],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("client_monitor_events");
    await queryRunner.dropTable("client_monitors");
  }
}
