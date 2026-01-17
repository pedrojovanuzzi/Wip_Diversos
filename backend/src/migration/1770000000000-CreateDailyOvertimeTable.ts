import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
} from "typeorm";

export class CreateDailyOvertimeTable1770000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "daily_overtime",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          {
            name: "employee_id",
            type: "int",
          },
          {
            name: "date",
            type: "date",
          },
          {
            name: "hours50",
            type: "decimal",
            precision: 5,
            scale: 2,
            default: 0,
          },
          {
            name: "hours100",
            type: "decimal",
            precision: 5,
            scale: 2,
            default: 0,
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
      true
    );

    await queryRunner.createForeignKey(
      "daily_overtime",
      new TableForeignKey({
        columnNames: ["employee_id"],
        referencedColumnNames: ["id"],
        referencedTableName: "employees",
        onDelete: "CASCADE",
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("daily_overtime");
    const foreignKey = table?.foreignKeys.find(
      (fk) => fk.columnNames.indexOf("employee_id") !== -1
    );
    if (foreignKey) {
      await queryRunner.dropForeignKey("daily_overtime", foreignKey);
    }
    await queryRunner.dropTable("daily_overtime");
  }
}
