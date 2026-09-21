import { MigrationInterface, QueryRunner } from "typeorm";

/** Data em que a NFS-e da mensalidade foi cancelada na prefeitura. */
export class AddNfseCanceladaLicencaMensalidade1784900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const colunas = (await queryRunner.query(
      "SHOW COLUMNS FROM `licenca_mensalidades`",
    )) as { Field: string }[];

    if (colunas.some((c) => c.Field === "nfse_cancelada_em")) return;

    await queryRunner.query(
      "ALTER TABLE `licenca_mensalidades` ADD COLUMN `nfse_cancelada_em` DATETIME NULL",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `licenca_mensalidades` DROP COLUMN `nfse_cancelada_em`",
    );
  }
}
