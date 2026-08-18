import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class AddProtocoloToServidoresAcesso1783800000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "servidores_acesso",
      new TableColumn({
        name: "protocolo",
        type: "varchar",
        length: "16",
        default: "'ssh'",
      }),
    );
    // OLTs cadastradas antes desta coluna falavam Telnet.
    await queryRunner.query(
      `UPDATE servidores_acesso SET protocolo = 'telnet' WHERE funcao = 'olt'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("servidores_acesso", "protocolo");
  }
}
