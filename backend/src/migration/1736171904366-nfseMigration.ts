import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class NfseMigration1736171904366 implements MigrationInterface {
    name = 'NfseMigration1736171904366'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'nfse',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'numero_rps',
                        type: 'int',
                        isNullable: false,
                    },
                    {
                        name: 'serie_rps',
                        type: 'varchar',
                        length: '20',
                        isNullable: false,
                    },
                    {
                        name: 'tipo_rps',
                        type: 'int',
                        isNullable: false,
                    },
                    {
                        name: 'data_emissao',
                        type: 'date',
                        isNullable: false,
                    },
                    {
                        name: 'competencia',
                        type: 'date',
                        isNullable: false,
                    },
                    {
                        name: 'valor_servico',
                        type: 'decimal',
                        precision: 10,
                        scale: 2,
                        isNullable: false,
                    },
                    {
                        name: 'aliquota',
                        type: 'decimal',
                        precision: 5,
                        scale: 2,
                        isNullable: false,
                    },
                    {
                        name: 'iss_retido',
                        type: 'int',
                        isNullable: false,
                    },
                    {
                        name: 'responsavel_retencao',
                        type: 'int',
                        isNullable: false,
                    },
                    {
                        name: 'item_lista_servico',
                        type: 'varchar',
                        length: '10',
                        isNullable: false,
                    },
                    {
                        name: 'discriminacao',
                        type: 'text',
                        isNullable: false,
                    },
                    {
                        name: 'codigo_municipio',
                        type: 'int',
                        isNullable: false,
                    },
                    {
                        name: 'exigibilidade_iss',
                        type: 'int',
                        isNullable: false,
                    },
                    {
                        name: 'cnpj_prestador',
                        type: 'varchar',
                        length: '14',
                        isNullable: false,
                    },
                    {
                        name: 'inscricao_municipal_prestador',
                        type: 'varchar',
                        length: '20',
                        isNullable: false,
                    },
                    {
                        name: 'cpf_tomador',
                        type: 'varchar',
                        length: '11',
                        isNullable: false,
                    },
                    {
                        name: 'razao_social_tomador',
                        type: 'varchar',
                        length: '100',
                        isNullable: false,
                    },
                    {
                        name: 'endereco_tomador',
                        type: 'varchar',
                        length: '100',
                        isNullable: false,
                    },
                    {
                        name: 'numero_endereco',
                        type: 'varchar',
                        length: '10',
                        isNullable: false,
                    },
                    {
                        name: 'complemento',
                        type: 'varchar',
                        length: '50',
                        isNullable: false,
                    },
                    {
                        name: 'bairro',
                        type: 'varchar',
                        length: '50',
                        isNullable: false,
                    },
                    {
                        name: 'uf',
                        type: 'varchar',
                        length: '2',
                        isNullable: false,
                    },
                    {
                        name: 'cep',
                        type: 'varchar',
                        length: '8',
                        isNullable: false,
                    },
                    {
                        name: 'telefone_tomador',
                        type: 'varchar',
                        length: '15',
                        isNullable: false,
                    },
                    {
                        name: 'email_tomador',
                        type: 'varchar',
                        length: '100',
                        isNullable: false,
                    },
                    {
                        name: 'optante_simples_nacional',
                        type: 'int',
                        isNullable: false,
                    },
                    {
                        name: 'incentivo_fiscal',
                        type: 'int',
                        isNullable: false,
                    },
                ],
            }),
            true
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('nfse');
    }
}
