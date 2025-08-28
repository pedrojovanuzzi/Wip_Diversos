import { MigrationInterface, QueryRunner, Table } from "typeorm";

export class DDDOSMigration1756385697569 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(new Table({
            name: 'dddos_monitoring',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: 'increment'
                },
                {
                    name: 'pppoe',
                    type: 'varchar',
                },
                {
                    name: 'ip',
                    type: 'varchar'
                },
                {
                    name: 'host',
                    type: 'varchar'
                },
                {
                    name: 'timestamp',
                    type: 'datetime',
                    default: 'CURRENT_TIMESTAMP',
                    isNullable: false,
                },
            ]
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('dddos_monitoring');
    }

}
