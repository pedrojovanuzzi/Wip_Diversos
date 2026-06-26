import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class FileShareMigration1782518400000 implements MigrationInterface {
  name = "FileShareMigration1782518400000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "file_shares",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          {
            name: "token",
            type: "varchar",
            length: "64",
            isUnique: true,
          },
          {
            name: "originalName",
            type: "varchar",
            length: "255",
          },
          {
            name: "storedName",
            type: "varchar",
            length: "255",
          },
          {
            name: "mimeType",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
          {
            name: "size",
            type: "bigint",
            default: 0,
          },
          {
            name: "downloads",
            type: "int",
            default: 0,
          },
          {
            name: "created_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("file_shares");
  }
}
