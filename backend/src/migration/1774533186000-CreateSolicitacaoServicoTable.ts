import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSolicitacaoServicoTable1774533186000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE solicitacoes_servico (
                id int AUTO_INCREMENT, 
                servico varchar(255), 
                pago boolean DEFAULT false, 
                login_cliente varchar(255), 
                data_solicitacao timestamp DEFAULT CURRENT_TIMESTAMP, 
                assinado boolean DEFAULT false, 
                PRIMARY KEY (id)
            );`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DROP TABLE solicitacoes_servico;`
        );
    }
}
