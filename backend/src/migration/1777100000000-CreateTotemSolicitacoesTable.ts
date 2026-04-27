import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTotemSolicitacoesTable1777100000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE totem_solicitacoes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        txid VARCHAR(100) NULL,
        valor DECIMAL(12,2) NULL,
        cpf_cnpj VARCHAR(20) NULL,
        login VARCHAR(100) NULL,
        pix_url TEXT NULL,
        horario TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_totem_pix_txid (txid),
        INDEX idx_totem_pix_cpf_cnpj (cpf_cnpj)
      );`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE totem_solicitacoes;`);
  }
}
