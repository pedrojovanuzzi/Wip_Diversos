import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFinalizadoToSolicitacaoServico1775010000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE solicitacoes_servico 
             ADD COLUMN finalizado BOOLEAN NOT NULL DEFAULT 0,
             ADD COLUMN id_chamado INT NULL;`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE solicitacoes_servico 
             DROP COLUMN finalizado,
             DROP COLUMN id_chamado;`
        );
    }
}
