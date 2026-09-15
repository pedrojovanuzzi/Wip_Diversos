import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * NFS-e Nacional (IssWebWSNacional): a nota passa a ser identificada pela chave
 * de acesso de 50 dígitos, e o cancelamento é um evento sobre essa chave.
 *
 * As notas antigas (ABRASF) continuam como estão: ficam com modelo 'abrasf' e
 * seguem sendo consultadas/canceladas pelo web service antigo.
 */
export class AddNfseNacional1784400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const colunas = (await queryRunner.query(
      "SHOW COLUMNS FROM `nfse`",
    )) as { Field: string }[];
    const existe = (nome: string) => colunas.some((c) => c.Field === nome);

    if (!existe("modelo")) {
      await queryRunner.query(
        "ALTER TABLE `nfse` ADD COLUMN `modelo` VARCHAR(20) NOT NULL DEFAULT 'abrasf'",
      );
    }
    if (!existe("chave_nfse")) {
      await queryRunner.query(
        "ALTER TABLE `nfse` ADD COLUMN `chave_nfse` VARCHAR(60) NULL",
      );
    }
    if (!existe("id_dps")) {
      await queryRunner.query(
        "ALTER TABLE `nfse` ADD COLUMN `id_dps` VARCHAR(60) NULL",
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("ALTER TABLE `nfse` DROP COLUMN `id_dps`");
    await queryRunner.query("ALTER TABLE `nfse` DROP COLUMN `chave_nfse`");
    await queryRunner.query("ALTER TABLE `nfse` DROP COLUMN `modelo`");
  }
}
