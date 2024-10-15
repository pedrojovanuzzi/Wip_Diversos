import { MigrationInterface, QueryRunner } from "typeorm";

export class UserMigration1729021464255 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE users (
                id int AUTO_INCREMENT, 
                login varchar(255) not null, 
                password varchar(255) not null, 
                PRIMARY KEY (id)
            );`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DROP TABLE users;`
        );
    }
}
