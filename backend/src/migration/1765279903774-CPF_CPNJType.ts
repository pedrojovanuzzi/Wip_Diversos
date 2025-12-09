import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class CPFCPNJType1765279903774 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "nfcom",
      new TableColumn({
        name: "cpf_cnpj",
        type: "varchar",
        length: "38",
        isNullable: false,
      })
    );
    await queryRunner.addColumn(
      "nfcom",
      new TableColumn({
        name: "tipo",
        type: "varchar",
        length: "50",
        isNullable: false,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("nfcom", "cpf_cnpj");
    await queryRunner.dropColumn("nfcom", "tipo");
  }
}
