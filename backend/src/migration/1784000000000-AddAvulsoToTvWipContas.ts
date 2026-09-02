import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Contas avulsas: acesso à TV WIP para quem não tem cadastro no MKAuth.
 *
 * A varredura diária ignora essas contas — não há cliente para comparar, e
 * sem a marcação ela as desativaria já na primeira madrugada.
 */
export class AddAvulsoToTvWipContas1784000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `tv_wip_contas` ADD `avulso` TINYINT(1) NOT NULL DEFAULT 0",
    );
    await queryRunner.query(
      "ALTER TABLE `tv_wip_contas` ADD `observacao` VARCHAR(255) NULL",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `tv_wip_contas` DROP COLUMN `observacao`");
    await queryRunner.query("ALTER TABLE `tv_wip_contas` DROP COLUMN `avulso`");
  }
}
