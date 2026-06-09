import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

/**
 * Adiciona `motion_roi` em `cameras`: região de interesse para a detecção de
 * movimento, em JSON normalizado {x,y,w,h} (frações 0..1 do quadro).
 * NULL = analisa o quadro inteiro (comportamento atual).
 */
export class AddMotionRoiToCameras1780900000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("cameras");
    if (table && !table.findColumnByName("motion_roi")) {
      await queryRunner.addColumn(
        "cameras",
        new TableColumn({
          name: "motion_roi",
          type: "varchar",
          length: "255",
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable("cameras");
    if (table && table.findColumnByName("motion_roi")) {
      await queryRunner.dropColumn("cameras", "motion_roi");
    }
  }
}
