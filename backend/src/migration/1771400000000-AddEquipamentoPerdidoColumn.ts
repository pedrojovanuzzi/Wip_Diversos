import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddEquipamentoPerdidoColumn1771400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "nfe",
      new TableColumn({
        name: "equipamento_perdido",
        type: "boolean",
        isNullable: true,
        default: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("nfe", "equipamento_perdido");
  }
}
