import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateNFETable1770000000003 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE nfe (
        id int AUTO_INCREMENT,
        nNF varchar(20) NOT NULL,
        serie varchar(5) NOT NULL,
        chave varchar(44) NOT NULL UNIQUE,
        xml longtext NOT NULL,
        protocolo varchar(50) NULL,
        status varchar(20) DEFAULT 'autorizada',
        data_emissao datetime NOT NULL,
        cliente_id int NULL,
        destinatario_nome varchar(255) NULL,
        destinatario_cpf_cnpj varchar(20) NULL,
        tipo_operacao varchar(50) NOT NULL,
        valor_total decimal(10,2) DEFAULT '0.00',
        tpAmb int DEFAULT 1,
        pdf_path varchar(255) NULL,
        PRIMARY KEY (id)
      );`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE nfe;`);
  }
}
