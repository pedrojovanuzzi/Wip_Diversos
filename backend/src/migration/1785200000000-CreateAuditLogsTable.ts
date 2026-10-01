import { MigrationInterface, QueryRunner } from "typeorm";

/** Trilha de auditoria de acessos e de ações de escrita dos usuários. */
export class CreateAuditLogsTable1785200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`audit_logs\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`user_id\` INT NULL,
        \`user_login\` VARCHAR(100) NULL,
        \`acao\` VARCHAR(16) NOT NULL,
        \`modulo\` VARCHAR(64) NULL,
        \`metodo\` VARCHAR(8) NULL,
        \`rota\` VARCHAR(255) NULL,
        \`status_code\` INT NULL,
        \`descricao\` VARCHAR(500) NULL,
        \`dados\` TEXT NULL,
        \`ip\` VARCHAR(64) NULL,
        \`user_agent\` VARCHAR(255) NULL,
        \`criado_em\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_audit_logs_criado_em\` (\`criado_em\`),
        KEY \`idx_audit_logs_user\` (\`user_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS `audit_logs`");
  }
}
