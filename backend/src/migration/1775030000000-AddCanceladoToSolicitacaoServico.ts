import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCanceladoToSolicitacaoServico1775030000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE solicitacoes_servico ADD COLUMN cancelado BOOLEAN NOT NULL DEFAULT false;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE solicitacoes_servico DROP COLUMN cancelado;`,
    );
  }
}
