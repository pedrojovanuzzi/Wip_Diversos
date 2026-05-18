import { MigrationInterface, QueryRunner } from "typeorm";

export class FeedbackNullableFields1779400000000 implements MigrationInterface {
  name = "FeedbackNullableFields1779400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const cols = [
      "opnion",
      "note_internet",
      "note_service",
      "note_response_time",
      "note_technician_service",
      "you_problem_as_solved",
      "you_recomend",
    ];
    for (const c of cols) {
      await queryRunner.query(
        `ALTER TABLE \`feedback\` MODIFY COLUMN \`${c}\` VARCHAR(255) NULL`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE \`feedback\` MODIFY COLUMN \`time\` DATETIME NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const cols = [
      "opnion",
      "note_internet",
      "note_service",
      "note_response_time",
      "note_technician_service",
      "you_problem_as_solved",
      "you_recomend",
    ];
    for (const c of cols) {
      await queryRunner.query(
        `ALTER TABLE \`feedback\` MODIFY COLUMN \`${c}\` VARCHAR(255) NOT NULL`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE \`feedback\` MODIFY COLUMN \`time\` DATETIME NOT NULL`,
    );
  }
}
