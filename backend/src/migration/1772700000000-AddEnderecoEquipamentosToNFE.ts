import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddEnderecoEquipamentosToNFE1772700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "nfe",
      new TableColumn({
        name: "endereco",
        type: "varchar",
        length: "255",
        isNullable: true,
      }),
    );

    await queryRunner.addColumn(
      "nfe",
      new TableColumn({
        name: "equipamentos",
        type: "json",
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("nfe", "equipamentos");
    await queryRunner.dropColumn("nfe", "endereco");
  }
}
