import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddTipoToZapSignTemplates1773010000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Adicionar a coluna 'tipo'
    await queryRunner.addColumn(
      "zapsign_templates",
      new TableColumn({
        name: "tipo",
        type: "varchar",
        length: "20",
        default: "'pago'",
      })
    );

    // 2. Inserir as versões 'gratis' dos serviços existentes
    await queryRunner.query(
      `INSERT INTO zapsign_templates (nome_servico, tipo) VALUES 
      ('Instalação', 'gratis'),
      ('Mudança de Endereço', 'gratis'),
      ('Mudança de Cômodo', 'gratis'),
      ('Troca de Titularidade', 'gratis'),
      ('Alteração de Plano', 'gratis'),
      ('Renovação Contratual', 'gratis'),
      ('Wifi Estendido', 'gratis');`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remover as versões 'gratis' inseridas
    await queryRunner.query(`DELETE FROM zapsign_templates WHERE tipo = 'gratis'`);
    
    // Remover a coluna 'tipo'
    await queryRunner.dropColumn("zapsign_templates", "tipo");
  }
}
