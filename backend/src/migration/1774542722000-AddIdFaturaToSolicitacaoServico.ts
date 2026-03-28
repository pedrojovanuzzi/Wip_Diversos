import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIdFaturaToSolicitacaoServico1774542722000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE solicitacoes_servico ADD COLUMN id_fatura int NULL;`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE solicitacoes_servico DROP COLUMN id_fatura;`
        );
    }
}
