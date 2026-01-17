import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTimeTrackingTables1769999999999
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE employees (
                id int AUTO_INCREMENT,
                name varchar(255) not null,
                role varchar(50),
                cpf varchar(14) unique,
                active boolean default true,
                created_at timestamp default current_timestamp,
                updated_at timestamp default current_timestamp on update current_timestamp,
                PRIMARY KEY (id)
            );`
    );
    await queryRunner.query(
      `CREATE TABLE time_records (
                id int AUTO_INCREMENT,
                employee_id int not null,
                timestamp timestamp default current_timestamp,
                type varchar(50),
                location varchar(255),
                photo_url varchar(255),
                created_at timestamp default current_timestamp,
                PRIMARY KEY (id),
                FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
            );`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE time_records;`);
    await queryRunner.query(`DROP TABLE employees;`);
  }
}
