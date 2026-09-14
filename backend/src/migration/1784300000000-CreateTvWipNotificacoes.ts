import { MigrationInterface, QueryRunner } from "typeorm";

/** Avisos do painel para o aplicativo da TV WIP. */
export class CreateTvWipNotificacoes1784300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`tv_wip_notificacoes\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`titulo\` VARCHAR(120) NOT NULL,
        \`mensagem\` TEXT NOT NULL,
        \`destino\` VARCHAR(20) NOT NULL DEFAULT 'todos',
        \`alvos\` TEXT NULL,
        \`ativo\` TINYINT(1) NOT NULL DEFAULT 1,
        \`expira_em\` DATETIME NULL,
        \`criado_por\` VARCHAR(100) NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_tv_wip_notificacoes_ativo\` (\`ativo\`, \`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS `tv_wip_notificacoes`");
  }
}
