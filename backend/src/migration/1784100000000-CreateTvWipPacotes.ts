import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Pacotes (grupos) de canais da TV WIP e o vínculo com as contas.
 *
 * Fica no banco do sistema (wip_diversos), não no wip_canais: os canais estão
 * em outro servidor, então a ligação é feita por `idcanal` — sem chave
 * estrangeira, porque bancos diferentes não se referenciam.
 */
export class CreateTvWipPacotes1784100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`tv_wip_pacotes\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`nome\` VARCHAR(100) NOT NULL,
        \`descricao\` VARCHAR(255) NULL,
        \`ativo\` TINYINT(1) NOT NULL DEFAULT 1,
        \`padrao\` TINYINT(1) NOT NULL DEFAULT 0,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_tv_wip_pacotes_nome\` (\`nome\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`tv_wip_pacote_canais\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`pacote_id\` INT NOT NULL,
        \`idcanal\` INT NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_pacote_canal\` (\`pacote_id\`, \`idcanal\`),
        KEY \`idx_pacote_canais_pacote\` (\`pacote_id\`),
        CONSTRAINT \`fk_pacote_canais_pacote\` FOREIGN KEY (\`pacote_id\`)
          REFERENCES \`tv_wip_pacotes\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`tv_wip_conta_pacotes\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`login\` VARCHAR(100) NOT NULL,
        \`pacote_id\` INT NOT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_conta_pacote\` (\`login\`, \`pacote_id\`),
        KEY \`idx_conta_pacotes_login\` (\`login\`),
        CONSTRAINT \`fk_conta_pacotes_pacote\` FOREIGN KEY (\`pacote_id\`)
          REFERENCES \`tv_wip_pacotes\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Exceção por cliente: libera um canal fora dos pacotes dele, ou bloqueia
    // um que os pacotes dariam. É o que permite "esse canal só para fulano".
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`tv_wip_conta_canais\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`login\` VARCHAR(100) NOT NULL,
        \`idcanal\` INT NOT NULL,
        \`permitido\` TINYINT(1) NOT NULL DEFAULT 1,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_conta_canal\` (\`login\`, \`idcanal\`),
        KEY \`idx_conta_canais_login\` (\`login\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS `tv_wip_conta_canais`");
    await queryRunner.query("DROP TABLE IF EXISTS `tv_wip_conta_pacotes`");
    await queryRunner.query("DROP TABLE IF EXISTS `tv_wip_pacote_canais`");
    await queryRunner.query("DROP TABLE IF EXISTS `tv_wip_pacotes`");
  }
}
