import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Dados fiscais do cliente da licença e o vínculo da mensalidade com a NFS-e.
 *
 * O tomador da nota de licença não está no MKAuth, então os dados exigidos
 * pela NFS-e (documento, endereço, município) ficam na própria licença.
 */
export class AddDadosFiscaisLicenca1784700000000 implements MigrationInterface {
  private async adicionar(
    queryRunner: QueryRunner,
    tabela: string,
    coluna: string,
    definicao: string,
  ) {
    const colunas = (await queryRunner.query(
      `SHOW COLUMNS FROM \`${tabela}\``,
    )) as { Field: string }[];
    if (colunas.some((c) => c.Field === coluna)) return;
    await queryRunner.query(
      `ALTER TABLE \`${tabela}\` ADD COLUMN \`${coluna}\` ${definicao}`,
    );
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const fiscaisDaLicenca: [string, string][] = [
      ["documento", "VARCHAR(14) NULL"],
      ["razao_social", "VARCHAR(255) NULL"],
      ["email", "VARCHAR(120) NULL"],
      ["telefone", "VARCHAR(20) NULL"],
      ["endereco", "VARCHAR(255) NULL"],
      ["numero", "VARCHAR(20) NULL"],
      ["complemento", "VARCHAR(120) NULL"],
      ["bairro", "VARCHAR(120) NULL"],
      ["cidade", "VARCHAR(120) NULL"],
      ["codigo_municipio", "VARCHAR(7) NULL"],
      ["uf", "VARCHAR(2) NULL"],
      ["cep", "VARCHAR(8) NULL"],
    ];

    for (const [coluna, definicao] of fiscaisDaLicenca) {
      await this.adicionar(queryRunner, "licencas", coluna, definicao);
    }

    const notaDaMensalidade: [string, string][] = [
      ["nfse_id", "INT NULL"],
      ["nfse_numero", "VARCHAR(30) NULL"],
      ["nfse_chave", "VARCHAR(60) NULL"],
      ["nfse_emitida_em", "DATETIME NULL"],
      ["nfse_erro", "TEXT NULL"],
    ];

    for (const [coluna, definicao] of notaDaMensalidade) {
      await this.adicionar(
        queryRunner,
        "licenca_mensalidades",
        coluna,
        definicao,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const coluna of [
      "nfse_id",
      "nfse_numero",
      "nfse_chave",
      "nfse_emitida_em",
      "nfse_erro",
    ]) {
      await queryRunner.query(
        `ALTER TABLE \`licenca_mensalidades\` DROP COLUMN \`${coluna}\``,
      );
    }

    for (const coluna of [
      "documento",
      "razao_social",
      "email",
      "telefone",
      "endereco",
      "numero",
      "complemento",
      "bairro",
      "cidade",
      "codigo_municipio",
      "uf",
      "cep",
    ]) {
      await queryRunner.query(
        `ALTER TABLE \`licencas\` DROP COLUMN \`${coluna}\``,
      );
    }
  }
}
