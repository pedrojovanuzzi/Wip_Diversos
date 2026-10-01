import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Histórico dos testes grátis da Watch TV: quem usou, quando e por quantos
 * dias. A assinatura de teste some quando o prazo acaba, então sem isto não
 * havia como somar os dias de teste na contratação paga.
 */
export class CreateStreamingTestes1785100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`streaming_testes\` (
        \`id\` INT NOT NULL AUTO_INCREMENT,
        \`login\` VARCHAR(100) NOT NULL,
        \`inicio\` DATETIME NOT NULL,
        \`fim_previsto\` DATETIME NULL,
        \`fim\` DATETIME NULL,
        \`dias\` INT NOT NULL DEFAULT 0,
        \`motivo_fim\` VARCHAR(20) NULL,
        \`criado_em\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`atualizado_em\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_streaming_testes_login\` (\`login\`, \`fim\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("DROP TABLE IF EXISTS `streaming_testes`");
  }
}
