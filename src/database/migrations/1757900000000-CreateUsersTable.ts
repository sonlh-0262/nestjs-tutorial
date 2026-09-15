import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUsersTable1757900000000 implements MigrationInterface {
  name = 'CreateUsersTable1757900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"            uuid          NOT NULL DEFAULT gen_random_uuid(),
        "email"         varchar(255)  NOT NULL,
        "username"      varchar(50)   NOT NULL,
        "password_hash" varchar(255)  NOT NULL,
        "bio"           text          NULL,
        "image"         varchar(512)  NULL,
        "created_at"    timestamptz   NOT NULL DEFAULT now(),
        "updated_at"    timestamptz   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_email" ON "users" ("email")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_username" ON "users" ("username")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."UQ_users_username"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_users_email"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
