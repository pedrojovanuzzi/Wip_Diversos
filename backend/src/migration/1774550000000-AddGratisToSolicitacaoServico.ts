import { MigrationInterface, QueryRunner } from "typeorm";

export class AddGratisToSolicitacaoServico1774550000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE solicitacoes_servico ADD COLUMN gratis int DEFAULT 0;`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE solicitacoes_servico DROP COLUMN gratis;`
        );
    }
}
