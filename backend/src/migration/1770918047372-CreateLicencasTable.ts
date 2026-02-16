import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateLicencasTable1770918047372 implements MigrationInterface {
  name = "CreateLicencasTable1770918047372";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("licencas");
    if (!table) {
      await queryRunner.query(
        `CREATE TABLE \`licencas\` (\`id\` int NOT NULL AUTO_INCREMENT, \`cliente_nome\` varchar(255) NOT NULL, \`software\` varchar(255) NULL, \`chave\` varchar(255) NOT NULL, \`status\` enum ('ativo', 'bloqueado', 'cancelado') NOT NULL DEFAULT 'ativo', \`observacao\` text NULL, \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE INDEX \`IDX_36ab90e32d886c59a6bfff4e07\` (\`chave\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`IDX_36ab90e32d886c59a6bfff4e07\` ON \`licencas\``,
    );
    await queryRunner.query(`DROP TABLE \`licencas\``);
  }
}
