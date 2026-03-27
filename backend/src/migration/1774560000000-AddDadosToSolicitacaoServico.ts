import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDadosToSolicitacaoServico1774560000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE solicitacoes_servico ADD COLUMN dados JSON NULL;`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE solicitacoes_servico DROP COLUMN dados;`
        );
    }
}
