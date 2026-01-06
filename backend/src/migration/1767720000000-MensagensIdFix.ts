import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class MensagensIdFix1767720000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumn(
      "mensagens",
      "id",
      new TableColumn({
        name: "id",
        type: "int",
        isPrimary: true,
        isGenerated: true,
        generationStrategy: "increment",
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumn(
      "mensagens",
      "id",
      new TableColumn({
        name: "id",
        type: "int",
        isPrimary: true,
        isGenerated: false,
      })
    );
  }
}
