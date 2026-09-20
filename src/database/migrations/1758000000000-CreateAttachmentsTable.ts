import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAttachmentsTable1758000000000 implements MigrationInterface {
  name = 'CreateAttachmentsTable1758000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "attachments" (
        "id"              uuid          NOT NULL DEFAULT gen_random_uuid(),
        "attachable_type" varchar(50)   NOT NULL,
        "attachable_id"   uuid          NOT NULL,
        "url"             varchar(512)  NOT NULL,
        "file_name"       varchar(255)  NOT NULL,
        "file_type"       varchar(100)  NOT NULL,
        "file_size"       integer       NOT NULL,
        "storage_path"    varchar(512)  NOT NULL,
        "created_at"      timestamptz   NOT NULL DEFAULT now(),
        "updated_at"      timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_attachments_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_attachments_attachable" ON "attachments" ("attachable_type", "attachable_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_attachments_attachable"`);
    await queryRunner.query(`DROP TABLE "attachments"`);
  }
}
