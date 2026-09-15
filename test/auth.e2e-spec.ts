import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/config/app-setup';
import { AppConfig } from '../src/config/configuration';
import { User } from '../src/users/entities/user.entity';

interface UserEnvelope {
  user: {
    email: string;
    username: string;
    bio: string | null;
    image: string | null;
    token?: string;
  };
}

const buildCredentials = () => {
  const suffix = randomUUID().slice(0, 8);

  return {
    username: `user_${suffix}`,
    email: `user_${suffix}@example.com`,
    password: 'Sup3rS3cret!',
  };
};

describe('Authentication (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    const appConfig = app.get(ConfigService).getOrThrow<AppConfig>('app');
    configureApp(app, appConfig);

    app.enableShutdownHooks();
    await app.init();

    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  const register = async (credentials = buildCredentials()) => {
    const response = await request(app.getHttpServer())
      .post('/users')
      .send({ user: credentials })
      .expect(201);

    const body = response.body as UserEnvelope;

    return { credentials, token: body.user.token as string, body };
  };

  describe('POST /users (register)', () => {
    it('creates an account and returns it with a token', async () => {
      const credentials = buildCredentials();

      const response = await request(app.getHttpServer())
        .post('/users')
        .send({ user: credentials })
        .expect(201);

      const { user } = response.body as UserEnvelope;

      expect(user.email).toBe(credentials.email);
      expect(user.username).toBe(credentials.username);
      expect(user.bio).toBeNull();
      expect(user.image).toBeNull();
      expect(typeof user.token).toBe('string');
    });

    it('never echoes the password or its hash', async () => {
      const credentials = buildCredentials();

      const response = await request(app.getHttpServer())
        .post('/users')
        .send({ user: credentials })
        .expect(201);

      const raw = JSON.stringify(response.body);
      expect(raw).not.toContain(credentials.password);
      expect(raw).not.toContain('passwordHash');
      expect(raw).not.toContain('password_hash');
    });

    it('stores a bcrypt hash rather than the password', async () => {
      const credentials = buildCredentials();
      await request(app.getHttpServer())
        .post('/users')
        .send({ user: credentials })
        .expect(201);

      const stored = await dataSource
        .getRepository(User)
        .createQueryBuilder('user')
        .addSelect('user.passwordHash')
        .where('user.email = :email', { email: credentials.email })
        .getOne();

      expect(stored?.passwordHash).toMatch(/^\$2[aby]\$/);
      expect(stored?.passwordHash).not.toBe(credentials.password);
    });

    it('lower-cases the email before storing it', async () => {
      const credentials = buildCredentials();

      const response = await request(app.getHttpServer())
        .post('/users')
        .send({
          user: { ...credentials, email: credentials.email.toUpperCase() },
        })
        .expect(201);

      expect((response.body as UserEnvelope).user.email).toBe(
        credentials.email,
      );
    });

    it('rejects a duplicate email with 409', async () => {
      const { credentials } = await register();

      await request(app.getHttpServer())
        .post('/users')
        .send({
          user: { ...credentials, username: `${credentials.username}_2` },
        })
        .expect(409);
    });

    it('treats a differently-cased email as a duplicate', async () => {
      const { credentials } = await register();

      await request(app.getHttpServer())
        .post('/users')
        .send({
          user: {
            ...credentials,
            email: credentials.email.toUpperCase(),
            username: `${credentials.username}_2`,
          },
        })
        .expect(409);
    });

    it('rejects a duplicate username with 409', async () => {
      const { credentials } = await register();
      const other = buildCredentials();

      await request(app.getHttpServer())
        .post('/users')
        .send({ user: { ...other, username: credentials.username } })
        .expect(409);
    });

    it('rejects a malformed email', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .send({ user: { ...buildCredentials(), email: 'not-an-email' } })
        .expect(400);
    });

    it('rejects a password shorter than 8 characters', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .send({ user: { ...buildCredentials(), password: 'short' } })
        .expect(400);
    });

    it('rejects a username containing characters that are not URL safe', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .send({ user: { ...buildCredentials(), username: 'not valid!' } })
        .expect(400);
    });

    it('rejects a body that is missing the `user` envelope', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .send(buildCredentials())
        .expect(400);
    });

    it('rejects unknown fields inside the envelope', async () => {
      await request(app.getHttpServer())
        .post('/users')
        .send({ user: { ...buildCredentials(), role: 'admin' } })
        .expect(400);
    });

    it('translates validation errors into the requested language', async () => {
      const response = await request(app.getHttpServer())
        .post('/users?lang=jp')
        .send({ user: { ...buildCredentials(), email: 'not-an-email' } })
        .expect(400);

      expect(JSON.stringify(response.body)).toContain('メールアドレス');
    });
  });

  describe('POST /users/login', () => {
    it('returns the user and a token for valid credentials', async () => {
      const { credentials } = await register();

      const response = await request(app.getHttpServer())
        .post('/users/login')
        .send({
          user: { email: credentials.email, password: credentials.password },
        })
        .expect(200);

      const { user } = response.body as UserEnvelope;

      expect(user.email).toBe(credentials.email);
      expect(typeof user.token).toBe('string');
    });

    it('accepts the email in a different case', async () => {
      const { credentials } = await register();

      await request(app.getHttpServer())
        .post('/users/login')
        .send({
          user: {
            email: credentials.email.toUpperCase(),
            password: credentials.password,
          },
        })
        .expect(200);
    });

    it('rejects a wrong password with 401', async () => {
      const { credentials } = await register();

      await request(app.getHttpServer())
        .post('/users/login')
        .send({
          user: { email: credentials.email, password: 'wrong-password' },
        })
        .expect(401);
    });

    it('answers an unknown email exactly like a wrong password', async () => {
      const { credentials } = await register();

      const unknown = await request(app.getHttpServer())
        .post('/users/login')
        .send({ user: { email: 'nobody@example.com', password: 'whatever' } })
        .expect(401);

      const wrongPassword = await request(app.getHttpServer())
        .post('/users/login')
        .send({
          user: { email: credentials.email, password: 'wrong-password' },
        })
        .expect(401);

      expect((unknown.body as { message: string }).message).toBe(
        (wrongPassword.body as { message: string }).message,
      );
    });

    it('localises the failure message', async () => {
      const response = await request(app.getHttpServer())
        .post('/users/login?lang=jp')
        .send({ user: { email: 'nobody@example.com', password: 'whatever' } })
        .expect(401);

      expect((response.body as { message: string }).message).toContain(
        'パスワード',
      );
    });
  });

  describe('GET /user (current user)', () => {
    it('returns the authenticated user', async () => {
      const { credentials, token } = await register();

      const response = await request(app.getHttpServer())
        .get('/user')
        .set('Authorization', `Token ${token}`)
        .expect(200);

      const { user } = response.body as UserEnvelope;

      expect(user.email).toBe(credentials.email);
      expect(user.username).toBe(credentials.username);
    });

    it('accepts the `Bearer` scheme as well as `Token`', async () => {
      const { token } = await register();

      await request(app.getHttpServer())
        .get('/user')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('does not return a token', async () => {
      const { token } = await register();

      const response = await request(app.getHttpServer())
        .get('/user')
        .set('Authorization', `Token ${token}`)
        .expect(200);

      expect((response.body as UserEnvelope).user.token).toBeUndefined();
    });

    it('rejects a request with no token', async () => {
      await request(app.getHttpServer()).get('/user').expect(401);
    });

    it('rejects a token that was not signed by this API', async () => {
      await request(app.getHttpServer())
        .get('/user')
        .set('Authorization', 'Token not.a.real.token')
        .expect(401);
    });

    it('localises the unauthorised message', async () => {
      const response = await request(app.getHttpServer())
        .get('/user?lang=jp')
        .expect(401);

      expect((response.body as { message: string }).message).toContain('認証');
    });
  });

  describe('POST /users/logout', () => {
    it('revokes the token it was called with', async () => {
      const { token } = await register();

      await request(app.getHttpServer())
        .get('/user')
        .set('Authorization', `Token ${token}`)
        .expect(200);

      await request(app.getHttpServer())
        .post('/users/logout')
        .set('Authorization', `Token ${token}`)
        .expect(200);

      await request(app.getHttpServer())
        .get('/user')
        .set('Authorization', `Token ${token}`)
        .expect(401);
    });

    it('leaves other sessions of the same user signed in', async () => {
      const { credentials, token: firstToken } = await register();

      const second = await request(app.getHttpServer())
        .post('/users/login')
        .send({
          user: { email: credentials.email, password: credentials.password },
        })
        .expect(200);

      const secondToken = (second.body as UserEnvelope).user.token as string;

      await request(app.getHttpServer())
        .post('/users/logout')
        .set('Authorization', `Token ${firstToken}`)
        .expect(200);

      await request(app.getHttpServer())
        .get('/user')
        .set('Authorization', `Token ${secondToken}`)
        .expect(200);
    });

    it('lets the user log in again afterwards', async () => {
      const { credentials, token } = await register();

      await request(app.getHttpServer())
        .post('/users/logout')
        .set('Authorization', `Token ${token}`)
        .expect(200);

      await request(app.getHttpServer())
        .post('/users/login')
        .send({
          user: { email: credentials.email, password: credentials.password },
        })
        .expect(200);
    });

    it('rejects logging out twice with the same token', async () => {
      const { token } = await register();

      await request(app.getHttpServer())
        .post('/users/logout')
        .set('Authorization', `Token ${token}`)
        .expect(200);

      await request(app.getHttpServer())
        .post('/users/logout')
        .set('Authorization', `Token ${token}`)
        .expect(401);
    });

    it('rejects a logout with no token', async () => {
      await request(app.getHttpServer()).post('/users/logout').expect(401);
    });

    it('confirms the logout in the requested language', async () => {
      const { token } = await register();

      const response = await request(app.getHttpServer())
        .post('/users/logout?lang=jp')
        .set('Authorization', `Token ${token}`)
        .expect(200);

      expect((response.body as { message: string }).message).toBe(
        'ログアウトしました',
      );
    });
  });

  describe('database schema', () => {
    it('was created by the migrations, not by synchronize', async () => {
      expect(dataSource.options.synchronize).toBe(false);

      const applied = await dataSource.query<{ name: string }[]>(
        'SELECT name FROM migrations ORDER BY timestamp',
      );

      expect(applied.map((row) => row.name)).toContain(
        'CreateUsersTable1757900000000',
      );
    });

    it('enforces uniqueness at the database level', async () => {
      const { credentials } = await register();

      await expect(
        dataSource.getRepository(User).insert({
          email: credentials.email,
          username: `${credentials.username}_direct`,
          passwordHash: 'irrelevant',
          bio: null,
          image: null,
        }),
      ).rejects.toThrow();
    });
  });
});
