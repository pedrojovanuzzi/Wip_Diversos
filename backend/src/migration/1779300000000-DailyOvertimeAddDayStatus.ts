import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class DailyOvertimeAddDayStatus1779300000000
  implements MigrationInterface
{
  name = "DailyOvertimeAddDayStatus1779300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "daily_overtime",
      new TableColumn({
        name: "day_status",
        type: "varchar",
        length: "20",
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("daily_overtime", "day_status");
  }
}
