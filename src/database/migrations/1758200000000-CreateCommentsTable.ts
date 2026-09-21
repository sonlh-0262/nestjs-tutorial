import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCommentsTable1758200000000 implements MigrationInterface {
  name = 'CreateCommentsTable1758200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "comments" (
        "id"         uuid        NOT NULL DEFAULT gen_random_uuid(),
        "body"       text        NOT NULL,
        "article_id" uuid        NOT NULL,
        "author_id"  uuid        NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_comments_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_comments_article_id_created_at" ON "comments" ("article_id", "created_at")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_comments_author_id" ON "comments" ("author_id")`,
    );

    await queryRunner.query(`
      ALTER TABLE "comments"
        ADD CONSTRAINT "FK_comments_article"
        FOREIGN KEY ("article_id") REFERENCES "articles"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "comments"
        ADD CONSTRAINT "FK_comments_author"
        FOREIGN KEY ("author_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_comments_author"`,
    );
    await queryRunner.query(
      `ALTER TABLE "comments" DROP CONSTRAINT "FK_comments_article"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_comments_author_id"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_comments_article_id_created_at"`,
    );
    await queryRunner.query(`DROP TABLE "comments"`);
  }
}
