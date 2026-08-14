import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddPapelToServiceLinks1783300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns("service_links", [
      new TableColumn({
        name: "papel",
        type: "varchar",
        length: "16",
        isNullable: true,
      }),
      new TableColumn({
        name: "par_token",
        type: "varchar",
        length: "64",
        isNullable: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("service_links", "par_token");
    await queryRunner.dropColumn("service_links", "papel");
  }
}
