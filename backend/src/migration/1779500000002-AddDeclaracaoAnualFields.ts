import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

const NEW_COLUMNS: { name: string; type: string; length?: string }[] = [
  { name: "declarante_nome", type: "varchar", length: "255" },
  { name: "declarante_cpf_cnpj", type: "varchar", length: "30" },
  { name: "declarante_endereco", type: "varchar", length: "255" },
  { name: "periodo_inicio", type: "date" },
  { name: "periodo_fim", type: "date" },
  { name: "signatario_cpf", type: "varchar", length: "30" },
  { name: "assinatura_base64", type: "longtext" },
];

export class AddDeclaracaoAnualFields1779500000002
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("declaracao_quitacao");
    if (!table) return;
    for (const col of NEW_COLUMNS) {
      if (table.columns.find((c) => c.name === col.name)) continue;
      await queryRunner.addColumn(
        "declaracao_quitacao",
        new TableColumn({
          name: col.name,
          type: col.type,
          length: col.length,
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("declaracao_quitacao");
    if (!table) return;
    for (const col of NEW_COLUMNS) {
      if (table.columns.find((c) => c.name === col.name)) {
        await queryRunner.dropColumn("declaracao_quitacao", col.name);
      }
    }
  }
}
