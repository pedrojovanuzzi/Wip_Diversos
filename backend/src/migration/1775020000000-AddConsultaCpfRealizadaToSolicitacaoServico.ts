import { MigrationInterface, QueryRunner } from "typeorm";

export class AddConsultaCpfRealizadaToSolicitacaoServico1775020000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE solicitacoes_servico ADD COLUMN consulta_cpf_realizada BOOLEAN NOT NULL DEFAULT false;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE solicitacoes_servico DROP COLUMN consulta_cpf_realizada;`,
    );
  }
}
