import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class Jobs1764784187393 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "jobs",
        columns: [
          {
            name: "id",
            type: "varchar", // UUID no MySQL é salvo como varchar(36)
            length: "36",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "uuid", // <--- Mudou de 'increment' para 'uuid'
          },
          {
            name: "name",
            type: "varchar",
          },
          {
            name: "description",
            type: "varchar",
          },
          {
            name: "status",
            type: "varchar",
          },
          {
            name: "total",
            type: "int",
          },
          {
            name: "processados",
            type: "int",
          },
          {
            name: "resultado",
            type: "json",
            isNullable: true,
          },
          {
            name: "created_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
          {
            name: "updated_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
            onUpdate: "CURRENT_TIMESTAMP",
          },
        ],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("jobs");
  }
}
