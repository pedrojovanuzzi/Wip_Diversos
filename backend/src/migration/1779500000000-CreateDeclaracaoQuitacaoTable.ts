import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateDeclaracaoQuitacaoTable1779500000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "declaracao_quitacao",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          { name: "tipo_pessoa", type: "varchar", length: "20" },
          { name: "nome", type: "varchar", length: "255" },
          { name: "cpf_cnpj", type: "varchar", length: "30" },
          { name: "login", type: "varchar", length: "100", isNullable: true },
          { name: "contrato", type: "varchar", length: "255", isNullable: true },
          { name: "data_declaracao", type: "date", isNullable: true },
          { name: "endereco", type: "varchar", length: "255", isNullable: true },
          { name: "bairro", type: "varchar", length: "255", isNullable: true },
          { name: "cidade", type: "varchar", length: "255", isNullable: true },
          {
            name: "ano_referencia",
            type: "varchar",
            length: "20",
            isNullable: true,
          },
          {
            name: "signatario_nome",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
          {
            name: "signatario_empresa",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
          { name: "pdf_base64", type: "longtext", isNullable: true },
          {
            name: "created_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("declaracao_quitacao");
  }
}
