import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateArticleFavoritesTable1758100200000 implements MigrationInterface {
  name = 'CreateArticleFavoritesTable1758100200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "article_favorites" (
        "user_id"    uuid        NOT NULL,
        "article_id" uuid        NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_article_favorites" PRIMARY KEY ("user_id", "article_id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_article_favorites_article_id" ON "article_favorites" ("article_id")`,
    );

    await queryRunner.query(`
      ALTER TABLE "article_favorites"
        ADD CONSTRAINT "FK_article_favorites_user"
        FOREIGN KEY ("user_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "article_favorites"
        ADD CONSTRAINT "FK_article_favorites_article"
        FOREIGN KEY ("article_id") REFERENCES "articles"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "article_favorites" DROP CONSTRAINT "FK_article_favorites_article"`,
    );
    await queryRunner.query(
      `ALTER TABLE "article_favorites" DROP CONSTRAINT "FK_article_favorites_user"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_article_favorites_article_id"`,
    );
    await queryRunner.query(`DROP TABLE "article_favorites"`);
  }
}
