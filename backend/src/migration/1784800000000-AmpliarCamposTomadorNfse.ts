import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Campos do tomador que não cabiam.
 *
 * `cpf_tomador` tinha 11 caracteres, tamanho de CPF: com tomador CNPJ a nota
 * era aceita pela prefeitura e só depois a gravação local estourava, deixando
 * a nota existindo lá e não aqui. Os outros campos são ampliados pelo mesmo
 * motivo — nome e endereço longos passam fácil dos 100.
 */
export class AmpliarCamposTomadorNfse1784800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const alteracoes = [
      "MODIFY `cpf_tomador` VARCHAR(14) NOT NULL",
      "MODIFY `razao_social_tomador` VARCHAR(255) NOT NULL",
      "MODIFY `endereco_tomador` VARCHAR(255) NOT NULL",
      "MODIFY `numero_endereco` VARCHAR(100) NOT NULL",
      "MODIFY `complemento` VARCHAR(150) NULL",
      "MODIFY `bairro` VARCHAR(120) NOT NULL",
      "MODIFY `telefone_tomador` VARCHAR(20) NULL",
      "MODIFY `email_tomador` VARCHAR(120) NULL",
    ];

    for (const alteracao of alteracoes) {
      await queryRunner.query(`ALTER TABLE \`nfse\` ${alteracao}`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Só volta o tamanho original do CPF; encurtar o resto poderia cortar
    // dados já gravados.
    await queryRunner.query(
      "ALTER TABLE `nfse` MODIFY `cpf_tomador` VARCHAR(11) NOT NULL",
    );
  }
}
