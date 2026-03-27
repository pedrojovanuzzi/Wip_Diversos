import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeIdChamadoToString1775017000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE solicitacoes_servico 
             MODIFY COLUMN id_chamado VARCHAR(255) NULL;`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE solicitacoes_servico 
             MODIFY COLUMN id_chamado INT NULL;`
        );
    }
}
