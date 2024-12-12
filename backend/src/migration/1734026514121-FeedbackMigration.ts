import { MigrationInterface, QueryRunner } from "typeorm";

export class FeedbackMigration1734026514121 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE feedback (
                id int AUTO_INCREMENT, 
                login varchar(255) not null, 
                opnion text null, 
                note_internet int(2) null,
                note_service int(2) null,
                note_response_time int(2) null,
                note_technician_service int(2) null,
                you_problem_as_solved bit null,
                you_recomend bit null,
                PRIMARY KEY (id)
            );`
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `DROP TABLE feedback;`
        );
    }

}
