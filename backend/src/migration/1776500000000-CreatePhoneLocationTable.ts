import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePhoneLocationTable1776500000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE phone_locations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_id VARCHAR(100) NOT NULL UNIQUE,
        person_name VARCHAR(255) NOT NULL,
        latitude DOUBLE NULL,
        longitude DOUBLE NULL,
        accuracy FLOAT NULL,
        battery FLOAT NULL,
        device_token VARCHAR(255) NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        last_position_at TIMESTAMP NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      );`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE phone_locations;`);
  }
}
