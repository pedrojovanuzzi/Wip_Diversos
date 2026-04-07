import { MigrationInterface, QueryRunner } from "typeorm";

export class AddConsultaCpfTentadaToSolicitacaoServico1775021000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE solicitacoes_servico ADD COLUMN consulta_cpf_tentada BOOLEAN NOT NULL DEFAULT false;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE solicitacoes_servico DROP COLUMN consulta_cpf_tentada;`,
    );
  }
}
