import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";
import { SolicitacaoServico } from "../entities/SolicitacaoServico";

export class AddTokenZapSignToSolicitacaoServico1774550000001 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            "solicitacoes_servico",
            new TableColumn({
                name: "token_zapsign",
                type: "varchar",
                length: "255",
                isNullable: true,
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn("solicitacoes_servico", "token_zapsign");
    }

}
