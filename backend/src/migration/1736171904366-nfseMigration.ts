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
                        name: 'login',
                        type: 'varchar',
                        length: '200',
                        isNullable: false,
                    },
                    {
                        name: 'numero_rps',
                        type: 'int',
                        isNullable: true,
                    },
                    {
                        name: 'serie_rps',
                        type: 'varchar',
                        length: '200',
                        isNullable: true,
                    },
                    {
                        name: 'tipo_rps',
                        type: 'int',
                        isNullable: true,
                    },
                    {
                        name: 'data_emissao',
                        type: 'date',
                        isNullable: true,
                    },
                    {
                        name: 'competencia',
                        type: 'date',
                        isNullable: true,
                    },
                    {
                        name: 'valor_servico',
                        type: 'decimal',
                        precision: 10,
                        scale: 2,
                        isNullable: true,
                    },
                    {
                        name: 'aliquota',
                        type: 'decimal',
                        precision: 9,
                        scale: 4,
                        isNullable: true,
                    },
                    {
                        name: 'iss_retido',
                        type: 'int',
                        isNullable: true,
                    },
                    {
                        name: 'responsavel_retencao',
                        type: 'int',
                        isNullable: true,
                    },
                    {
                        name: 'item_lista_servico',
                        type: 'varchar',
                        length: '100',
                        isNullable: true,
                    },
                    {
                        name: 'discriminacao',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'codigo_municipio',
                        type: 'int',
                        isNullable: true,
                    },
                    {
                        name: 'exigibilidade_iss',
                        type: 'int',
                        isNullable: true,
                    },
                    {
                        name: 'cnpj_prestador',
                        type: 'varchar',
                        length: '140',
                        isNullable: true,
                        default: '0',
                    },
                    {
                        name: 'inscricao_municipal_prestador',
                        type: 'varchar',
                        length: '20',
                        isNullable: true,
                    },
                    {
                        name: 'cpf_tomador',
                        type: 'varchar',
                        length: '140',
                        isNullable: true,
                        default: '0',
                    },
                    {
                        name: 'razao_social_tomador',
                        type: 'varchar',
                        length: '100',
                        isNullable: true,
                    },
                    {
                        name: 'endereco_tomador',
                        type: 'varchar',
                        length: '100',
                        isNullable: true,
                    },
                    {
                        name: 'numero_endereco',
                        type: 'varchar',
                        length: '100',
                        isNullable: true,
                    },
                    {
                        name: 'complemento',
                        type: 'varchar',
                        length: '50',
                        isNullable: true,
                    },
                    {
                        name: 'bairro',
                        type: 'varchar',
                        length: '50',
                        isNullable: true,
                    },
                    {
                        name: 'uf',
                        type: 'varchar',
                        length: '2',
                        isNullable: true,
                    },
                    {
                        name: 'cep',
                        type: 'varchar',
                        length: '8',
                        isNullable: true,
                    },
                    {
                        name: 'telefone_tomador',
                        type: 'varchar',
                        length: '15',
                        isNullable: true,
                    },
                    {
                        name: 'email_tomador',
                        type: 'varchar',
                        length: '100',
                        isNullable: true,
                    },
                    {
                        name: 'optante_simples_nacional',
                        type: 'int',
                        isNullable: true,
                    },
                    {
                        name: 'incentivo_fiscal',
                        type: 'int',
                        isNullable: true,
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
