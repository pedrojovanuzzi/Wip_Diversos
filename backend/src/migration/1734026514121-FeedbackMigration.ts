import { MigrationInterface, QueryRunner } from "typeorm";

export class FeedbackMigration1734026514121 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE feedback (
                id int AUTO_INCREMENT, 
                login varchar(255) NOT NULL, 
                unique_identifier varchar(255) NOT NULL UNIQUE, 
                opnion text NULL, 
                note_internet int(2) NULL,
                note_service int(2) NULL,
                note_response_time int(2) NULL,
                note_technician_service int(2) NULL,
                you_problem_as_solved bit NULL,
                you_recomend bit NULL,
                used bit NULL,
                time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, 
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
