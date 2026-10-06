import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/**
 * Marca o dia cujas horas extras foram digitadas por um administrador: o
 * cálculo automático deixa de sobrescrever enquanto a marca estiver ligada.
 */
export class DailyOvertimeAddHoursManual1785300000000
  implements MigrationInterface
{
  name = "DailyOvertimeAddHoursManual1785300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "daily_overtime",
      new TableColumn({
        name: "hours_manual",
        type: "boolean",
        default: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("daily_overtime", "hours_manual");
  }
}
