import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Documentos do Serviço de Valor Adicionado (SVA), exigidos pela Resolução
 * 777/2025 e usados nos planos combo.
 *
 * Registrados só com tipo 'pago': ao contrário da instalação, estes dois não
 * mudam conforme haja cobrança — o tipo existe apenas porque é a chave da
 * tabela junto com o nome do serviço, e 'pago' é o que a tela já traz
 * selecionado.
 *
 * O token fica vazio de propósito: ele nasce quando o .docx é enviado pela
 * tela de configuração, que cria o template no ZapSign e grava o retorno.
 */
export class AddSvaZapSignTemplates1784200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO zapsign_templates (nome_servico, tipo, token_id) VALUES
      ('Termo de Adesão SVA', 'pago', NULL),
      ('Contrato de SVA', 'pago', NULL);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM zapsign_templates
        WHERE nome_servico IN ('Termo de Adesão SVA', 'Contrato de SVA');`,
    );
  }
}
