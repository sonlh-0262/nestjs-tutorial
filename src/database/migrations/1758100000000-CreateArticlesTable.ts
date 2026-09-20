import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateArticlesTable1758100000000 implements MigrationInterface {
  name = 'CreateArticlesTable1758100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "articles" (
        "id"          uuid          NOT NULL DEFAULT gen_random_uuid(),
        "slug"        varchar(255)  NOT NULL,
        "title"       varchar(255)  NOT NULL,
        "description" varchar(500)  NOT NULL,
        "body"        text          NOT NULL,
        "author_id"   uuid          NOT NULL,
        "created_at"  timestamptz   NOT NULL DEFAULT now(),
        "updated_at"  timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_articles_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_articles_slug" ON "articles" ("slug")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_articles_author_id" ON "articles" ("author_id")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_articles_created_at" ON "articles" ("created_at")`,
    );

    await queryRunner.query(`
      ALTER TABLE "articles"
        ADD CONSTRAINT "FK_articles_author"
        FOREIGN KEY ("author_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "articles" DROP CONSTRAINT "FK_articles_author"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_articles_created_at"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_articles_author_id"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_articles_slug"`);
    await queryRunner.query(`DROP TABLE "articles"`);
  }
}
