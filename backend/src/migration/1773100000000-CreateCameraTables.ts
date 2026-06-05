import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class CreateCameraTables1773100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "camera_clientes",
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
            length: "255",
            isUnique: true,
          },
          {
            name: "email",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
          {
            name: "password",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
          {
            name: "setup_uuid",
            type: "varchar",
            length: "36",
            isNullable: true,
            isUnique: true,
          },
          {
            name: "status",
            type: "enum",
            enum: ["pendente", "ativo", "bloqueado"],
            default: "'pendente'",
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
      }),
      true,
    );

    await queryRunner.createTable(
      new Table({
        name: "cameras",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          {
            name: "cliente_id",
            type: "int",
          },
          {
            name: "nome",
            type: "varchar",
            length: "255",
          },
          {
            name: "rtsp_url",
            type: "text",
          },
          {
            name: "path_name",
            type: "varchar",
            length: "64",
            isUnique: true,
          },
          {
            name: "ativo",
            type: "boolean",
            default: true,
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
      }),
      true,
    );

    await queryRunner.createIndex(
      "cameras",
      new TableIndex({
        name: "IDX_cameras_cliente_id",
        columnNames: ["cliente_id"],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("cameras");
    await queryRunner.dropTable("camera_clientes");
  }
}
