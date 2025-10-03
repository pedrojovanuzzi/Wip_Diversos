import { MigrationInterface, QueryRunner } from "typeorm";

export class UserAddPermission1759513987184 implements MigrationInterface {
    name = 'UserAddPermission1759513987184'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`permission\` int NOT NULL DEFAULT '1'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`permission\``);
    }

}
