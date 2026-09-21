import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTagsTable1758100100000 implements MigrationInterface {
  name = 'CreateTagsTable1758100100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tags" (
        "id"         uuid         NOT NULL DEFAULT gen_random_uuid(),
        "name"       varchar(50)  NOT NULL,
        "created_at" timestamptz  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_tags_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_tags_name" ON "tags" ("name")`,
    );

    await queryRunner.query(`
      CREATE TABLE "article_tags" (
        "article_id" uuid NOT NULL,
        "tag_id"     uuid NOT NULL,
        CONSTRAINT "PK_article_tags" PRIMARY KEY ("article_id", "tag_id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_f8c9234a4c4cb37806387f0c9e" ON "article_tags" ("article_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1325dd0b98ee0f8f673db6ce19" ON "article_tags" ("tag_id")`,
    );

    await queryRunner.query(`
      ALTER TABLE "article_tags"
        ADD CONSTRAINT "FK_article_tags_article"
        FOREIGN KEY ("article_id") REFERENCES "articles"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "article_tags"
        ADD CONSTRAINT "FK_article_tags_tag"
        FOREIGN KEY ("tag_id") REFERENCES "tags"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "article_tags" DROP CONSTRAINT "FK_article_tags_tag"`,
    );
    await queryRunner.query(
      `ALTER TABLE "article_tags" DROP CONSTRAINT "FK_article_tags_article"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_1325dd0b98ee0f8f673db6ce19"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_f8c9234a4c4cb37806387f0c9e"`,
    );
    await queryRunner.query(`DROP TABLE "article_tags"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_tags_name"`);
    await queryRunner.query(`DROP TABLE "tags"`);
  }
}
