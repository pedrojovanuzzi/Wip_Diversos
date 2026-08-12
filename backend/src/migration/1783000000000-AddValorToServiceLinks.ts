import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddValorToServiceLinks1783000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "service_links",
      new TableColumn({
        name: "valor",
        type: "decimal",
        precision: 10,
        scale: 2,
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("service_links", "valor");
  }
}
