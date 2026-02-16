import { MigrationInterface, QueryRunner, TableIndex } from "typeorm";

export class AddNfeUniqueConstraint1770918047375 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if index already exists before creation to avoid errors
    const table = await queryRunner.getTable("nfe");
    const indexName = "UQ_NFE_NUMERATION";
    const existingIndex = table?.indices.find(
      (index) => index.name === indexName,
    );

    if (!existingIndex) {
      await queryRunner.createIndex(
        "nfe",
        new TableIndex({
          name: "UQ_NFE_NUMERATION",
          columnNames: ["nNF", "serie"],
          isUnique: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex("nfe", "UQ_NFE_NUMERATION");
  }
}
