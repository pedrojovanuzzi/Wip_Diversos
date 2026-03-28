import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class CreateZapSignTemplates1773000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "zapsign_templates",
        columns: [
          {
            name: "id",
            type: "int",
            isPrimary: true,
            isGenerated: true,
            generationStrategy: "increment",
          },
          {
            name: "nome_servico",
            type: "varchar",
            length: "255",
          },
          {
            name: "base64_docx",
            type: "longtext",
            isNullable: true,
          },
          {
            name: "token_id",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
        ],
      }),
      true,
    );

    await queryRunner.query(
      `INSERT INTO zapsign_templates (nome_servico, token_id) VALUES 
      ('Instalação', '57805314-73c9-4bb9-9ee8-caa0a457e192'),
      ('Mudança de Endereço', '440d2c52-988a-4e4b-b9fe-722c6d2b163a'),
      ('Mudança de Cômodo', NULL),
      ('Troca de Titularidade', NULL),
      ('Alteração de Plano', NULL),
      ('Renovação Contratual', NULL),
      ('Wifi Estendido', NULL);`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("zapsign_templates");
  }
}
