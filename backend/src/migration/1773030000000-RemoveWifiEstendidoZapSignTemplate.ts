import { MigrationInterface, QueryRunner } from "typeorm";

export class RemoveWifiEstendidoZapSignTemplate1773030000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM zapsign_templates WHERE nome_servico = 'Wifi Estendido';`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO zapsign_templates (nome_servico, tipo, token_id) VALUES
      ('Wifi Estendido', 'pago', NULL),
      ('Wifi Estendido', 'gratis', NULL);`
    );
  }
}
