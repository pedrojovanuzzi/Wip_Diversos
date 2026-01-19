import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddSignatureToDailyOvertime1770000000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "daily_overtime",
      new TableColumn({
        name: "signature",
        type: "longtext",
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("daily_overtime", "signature");
  }
}
