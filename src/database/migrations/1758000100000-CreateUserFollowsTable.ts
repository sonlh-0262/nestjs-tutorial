import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserFollowsTable1758000100000 implements MigrationInterface {
  name = 'CreateUserFollowsTable1758000100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user_follows" (
        "follower_id"  uuid        NOT NULL,
        "following_id" uuid        NOT NULL,
        "created_at"   timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_user_follows_not_self" CHECK ("follower_id" <> "following_id"),
        CONSTRAINT "PK_user_follows" PRIMARY KEY ("follower_id", "following_id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_user_follows_following_id" ON "user_follows" ("following_id")`,
    );

    await queryRunner.query(`
      ALTER TABLE "user_follows"
        ADD CONSTRAINT "FK_user_follows_follower"
        FOREIGN KEY ("follower_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "user_follows"
        ADD CONSTRAINT "FK_user_follows_following"
        FOREIGN KEY ("following_id") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_follows" DROP CONSTRAINT "FK_user_follows_following"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_follows" DROP CONSTRAINT "FK_user_follows_follower"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_follows_following_id"`,
    );
    await queryRunner.query(`DROP TABLE "user_follows"`);
  }
}
