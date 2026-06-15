import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/**
 * Adiciona `storage_gb` em `camera_clientes`: cota de armazenamento das
 * gravações em GB. Padrão 5 (plano base). Planos: 5, 10, 15 ou 20 GB.
 */
export class AddStorageGbToCameraClientes1780900000006
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("camera_clientes");
    if (table && !table.findColumnByName("storage_gb")) {
      await queryRunner.addColumn(
        "camera_clientes",
        new TableColumn({
          name: "storage_gb",
          type: "int",
          isNullable: false,
          default: 5,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("camera_clientes");
    if (table && table.findColumnByName("storage_gb")) {
      await queryRunner.dropColumn("camera_clientes", "storage_gb");
    }
  }
}
