import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAutoIncrementToConversations1771500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const pcTable = await queryRunner.getTable("people_conversations");
    if (pcTable) {
      const idColumn = pcTable.columns.find((c) => c.name === "id");
      if (idColumn) {
        if (!idColumn.isPrimary) {
          await queryRunner.createPrimaryKey("people_conversations", ["id"]);
        }
        if (!idColumn.isGenerated) {
          await queryRunner.query(
            "ALTER TABLE `people_conversations` MODIFY `id` INT NOT NULL AUTO_INCREMENT",
          );
        }
      }
    }

    const convTable = await queryRunner.getTable("conversations");
    if (convTable) {
      const idColumn = convTable.columns.find((c) => c.name === "id");
      if (idColumn) {
        if (!idColumn.isPrimary) {
          await queryRunner.createPrimaryKey("conversations", ["id"]);
        }
        if (!idColumn.isGenerated) {
          await queryRunner.query(
            "ALTER TABLE `conversations` MODIFY `id` INT NOT NULL AUTO_INCREMENT",
          );
        }
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // A remoção de chaves primárias ou auto increment aqui é complexa
    // pois não sabemos o estado anterior com certeza absoluta (se a PK foi criada por nós ou não).
    // Deixaremos vazio por segurança.
  }
}
