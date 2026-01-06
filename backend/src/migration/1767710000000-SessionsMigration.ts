import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class SessionsMigration1767710000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "sessions",
        columns: [
          {
            name: "celular",
            type: "varchar",
            length: "20",
            isPrimary: true,
            isNullable: false,
          },
          {
            name: "stage",
            type: "varchar",
            length: "50",
            isNullable: false,
            default: "''",
          },
          {
            name: "dados",
            type: "json",
            isNullable: true,
          },
          {
            name: "updated_at",
            type: "datetime",
            default: "CURRENT_TIMESTAMP",
            onUpdate: "CURRENT_TIMESTAMP",
            isNullable: false,
          },
        ],
      }),
      true
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("sessions");
  }
}
