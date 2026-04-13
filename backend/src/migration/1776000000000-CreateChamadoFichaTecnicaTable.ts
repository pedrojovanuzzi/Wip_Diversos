import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateChamadoFichaTecnicaTable1776000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE chamados_ficha_tecnica (
        id INT AUTO_INCREMENT,
        chamado_number VARCHAR(64) NOT NULL,
        cliente VARCHAR(255) NOT NULL,
        usuario VARCHAR(255) NOT NULL,
        senha_wifi VARCHAR(255) NULL,
        nota INT NULL,
        tec_externo VARCHAR(64) DEFAULT 'NENHUM',
        tec_interno VARCHAR(64) DEFAULT 'NENHUM',
        tec_carro VARCHAR(64) DEFAULT 'NENHUM',
        placa_carro VARCHAR(32) NULL,
        servico VARCHAR(64) NOT NULL,
        porta_olt VARCHAR(64) NULL,
        olt VARCHAR(64) NULL,
        caixa VARCHAR(64) NULL,
        splitter VARCHAR(64) NULL,
        sinal_power_meter VARCHAR(64) NULL,
        sinal_onu_antena VARCHAR(64) NULL,
        sinal_ccq_caixa VARCHAR(64) NULL,
        ssid VARCHAR(128) NULL,
        mac VARCHAR(64) NULL,
        sn VARCHAR(64) NULL,
        horario_registro VARCHAR(64) NULL,
        equipamentos JSON NULL,
        motivo TEXT NULL,
        observacao LONGTEXT NULL,
        responsavel_nome VARCHAR(255) NULL,
        responsavel_cpf VARCHAR(32) NULL,
        assinatura_base64 LONGTEXT NULL,
        criado_por INT NULL,
        criado_por_login VARCHAR(255) NULL,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        mkauth_chamado_id VARCHAR(64) NULL,
        mkauth_sincronizado BOOLEAN DEFAULT FALSE,
        mkauth_erro TEXT NULL,
        PRIMARY KEY (id),
        INDEX idx_usuario (usuario),
        INDEX idx_criado_em (criado_em),
        INDEX idx_chamado_number (chamado_number)
      );`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE chamados_ficha_tecnica;`);
  }
}
