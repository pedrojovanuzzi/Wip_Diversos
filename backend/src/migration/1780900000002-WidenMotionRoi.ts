import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Alarga `cameras.motion_roi` para varchar(1024): agora guarda um array de
 * retângulos (várias áreas de detecção), não mais um único objeto.
 */
export class WidenMotionRoi1780900000002 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `cameras` MODIFY `motion_roi` VARCHAR(1024) NULL",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `cameras` MODIFY `motion_roi` VARCHAR(255) NULL",
    );
  }
}
