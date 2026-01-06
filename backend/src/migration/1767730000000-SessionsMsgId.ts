import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class SessionsMsgId1767730000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "sessions",
      new TableColumn({
        name: "last_message_id",
        type: "varchar",
        length: "255",
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("sessions", "last_message_id");
  }
}
