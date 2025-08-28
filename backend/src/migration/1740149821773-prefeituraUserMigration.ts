import { MigrationInterface, QueryRunner, Table } from "typeorm";



export class PrefeituraUserMigration1740149821773 implements MigrationInterface {
    name = 'PrefeituraUserMigration1740149821773'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'pref_user',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                        
                    },
                    {
                        name: 'name',
                        type: 'varchar',
                        isNullable: false,
                        length: '90',
                    },
                    {
                        name: 'celular',
                        type: 'varchar',
                        isNullable: false,
                        length: '255',
                    },
                    {
                        name: 'cpf',
                        type: 'varchar',
                        isNullable: true,
                        length: '255',
                    },
                    {
                        name: 'ip',
                        type: 'varchar',
                        isNullable: false,
                        length: '40',
                    },
                    {
                        name: 'mac',
                        type: 'varchar',
                        isNullable: false,
                        length: '80',
                    },
                    {
                        name: 'uuid',
                        type: 'varchar',
                        isNullable: false,
                        length: '80',
                    },
                    {
                        name: "created_at",
                        type: "timestamp",
                        default: "now()",
                    },
                    {
                        name: "updated_at",
                        type: "timestamp",
                        default: "now()",
                    }
                ]
            }),
            true
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('pref_user');
    }

}
