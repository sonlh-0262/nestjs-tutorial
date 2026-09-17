import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import { Attachment } from '../src/attachments/entities/attachment.entity';
import { LocalFileStorage } from '../src/attachments/storage/local-file-storage';
import { configureApp } from '../src/config/app-setup';
import { AppConfig } from '../src/config/configuration';
import { StorageConfig } from '../src/config/storage.config';
import { UserFollow } from '../src/users/entities/user-follow.entity';
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

interface ProfileEnvelope {
  profile: {
    username: string;
    bio: string | null;
    image: string | null;
    following: boolean;
  };
}

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

const buildCredentials = () => {
  const suffix = randomUUID().slice(0, 8);

  return {
    username: `user_${suffix}`,
    email: `user_${suffix}@example.com`,
    password: 'Sup3rS3cret!',
  };
};

describe('User, profiles and attachments (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let storage: LocalFileStorage;
  let storageConfig: StorageConfig;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    const configService = app.get(ConfigService);
    configureApp(app, configService.getOrThrow<AppConfig>('app'));
    storageConfig = configService.getOrThrow<StorageConfig>('storage');

    app.enableShutdownHooks();
    await app.init();

    dataSource = app.get(DataSource);
    storage = app.get(LocalFileStorage);
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

    return { credentials, token: body.user.token as string };
  };

  const attachmentIdOf = (image: string | null): string =>
    (image ?? '').replace('/attachments/', '');

  describe('PUT /user (update, JSON)', () => {
    it('updates the bio', async () => {
      const { token } = await register();

      const response = await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .send({ user: { bio: 'I work at statefarm' } })
        .expect(200);

      expect((response.body as UserEnvelope).user.bio).toBe(
        'I work at statefarm',
      );
    });

    it('updates the username', async () => {
      const { token } = await register();
      const username = `renamed_${randomUUID().slice(0, 8)}`;

      const response = await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .send({ user: { username } })
        .expect(200);

      expect((response.body as UserEnvelope).user.username).toBe(username);
    });

    it('lower-cases a new email', async () => {
      const { token } = await register();
      const email = `Renamed_${randomUUID().slice(0, 8)}@Example.COM`;

      const response = await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .send({ user: { email } })
        .expect(200);

      expect((response.body as UserEnvelope).user.email).toBe(
        email.toLowerCase(),
      );
    });

    it('changes the password, and the new one works', async () => {
      const { credentials, token } = await register();

      await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .send({ user: { password: 'An0therS3cret!' } })
        .expect(200);

      await request(app.getHttpServer())
        .post('/users/login')
        .send({
          user: { email: credentials.email, password: 'An0therS3cret!' },
        })
        .expect(200);
    });

    it('retires the old password', async () => {
      const { credentials, token } = await register();

      await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .send({ user: { password: 'An0therS3cret!' } })
        .expect(200);

      await request(app.getHttpServer())
        .post('/users/login')
        .send({
          user: { email: credentials.email, password: credentials.password },
        })
        .expect(401);
    });

    it('never echoes the new password', async () => {
      const { token } = await register();

      const response = await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .send({ user: { password: 'An0therS3cret!' } })
        .expect(200);

      const raw = JSON.stringify(response.body);
      expect(raw).not.toContain('An0therS3cret!');
      expect(raw).not.toContain('passwordHash');
    });

    it('leaves the fields that were not sent alone', async () => {
      const { credentials, token } = await register();

      await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .send({ user: { bio: 'first' } })
        .expect(200);

      const response = await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .send({ user: { image: 'https://example.com/a.png' } })
        .expect(200);

      const { user } = response.body as UserEnvelope;
      expect(user.bio).toBe('first');
      expect(user.username).toBe(credentials.username);
    });

    it('clears the bio when sent null', async () => {
      const { token } = await register();

      await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .send({ user: { bio: 'something' } })
        .expect(200);

      const response = await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .send({ user: { bio: null } })
        .expect(200);

      expect((response.body as UserEnvelope).user.bio).toBeNull();
    });

    it('treats an empty string as a request to clear', async () => {
      const { token } = await register();

      const response = await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .send({ user: { bio: '' } })
        .expect(200);

      expect((response.body as UserEnvelope).user.bio).toBeNull();
    });

    it('accepts an empty update and changes nothing', async () => {
      const { credentials, token } = await register();

      const response = await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .send({ user: {} })
        .expect(200);

      expect((response.body as UserEnvelope).user.username).toBe(
        credentials.username,
      );
    });

    it('lets you re-submit your own email without a conflict', async () => {
      const { credentials, token } = await register();

      await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .send({
          user: {
            email: credentials.email,
            username: credentials.username,
          },
        })
        .expect(200);
    });

    it('rejects an email another account already holds', async () => {
      const other = await register();
      const { token } = await register();

      await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .send({ user: { email: other.credentials.email } })
        .expect(409);
    });

    it('rejects a username another account already holds', async () => {
      const other = await register();
      const { token } = await register();

      await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .send({ user: { username: other.credentials.username } })
        .expect(409);
    });

    it('rejects a malformed email', async () => {
      const { token } = await register();

      await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .send({ user: { email: 'not-an-email' } })
        .expect(400);
    });

    it('rejects a password that is too short', async () => {
      const { token } = await register();

      await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .send({ user: { password: 'short' } })
        .expect(400);
    });

    it('rejects unknown fields inside the envelope', async () => {
      const { token } = await register();

      await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .send({ user: { role: 'admin' } })
        .expect(400);
    });

    it('rejects a request with no token', async () => {
      await request(app.getHttpServer())
        .put('/user')
        .send({ user: { bio: 'anything' } })
        .expect(401);
    });

    it('rejects a token that has been logged out', async () => {
      const { token } = await register();

      await request(app.getHttpServer())
        .post('/users/logout')
        .set('Authorization', `Token ${token}`)
        .expect(200);

      await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .send({ user: { bio: 'anything' } })
        .expect(401);
    });

    it('localises the conflict message', async () => {
      const other = await register();
      const { token } = await register();

      const response = await request(app.getHttpServer())
        .put('/user?lang=jp')
        .set('Authorization', `Token ${token}`)
        .send({ user: { email: other.credentials.email } })
        .expect(409);

      expect((response.body as { message: string }).message).toContain(
        'メールアドレス',
      );
    });
  });

  describe('PUT /user (avatar upload, multipart)', () => {
    it('stores the file and points the user at it', async () => {
      const { token } = await register();

      const response = await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .attach('avatar', PNG, 'me.png')
        .expect(200);

      expect((response.body as UserEnvelope).user.image).toMatch(
        /^\/attachments\/[0-9a-f-]{36}$/,
      );
    });

    it('records what was uploaded against the owning user', async () => {
      const { token } = await register();

      const response = await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .attach('avatar', PNG, 'me.png')
        .expect(200);

      const id = attachmentIdOf((response.body as UserEnvelope).user.image);
      const row = await dataSource
        .getRepository(Attachment)
        .findOneByOrFail({ id });

      expect(row.attachableType).toBe('User');
      expect(row.fileType).toBe('image/png');
      expect(row.fileSize).toBe(PNG.length);
      expect(row.fileName).toBe('me.png');
      expect(row.url).toBe(`/attachments/${id}`);
    });

    it('links the attachment to the user who uploaded it', async () => {
      const { credentials, token } = await register();

      const response = await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .attach('avatar', PNG, 'me.png')
        .expect(200);

      const id = attachmentIdOf((response.body as UserEnvelope).user.image);
      const row = await dataSource
        .getRepository(Attachment)
        .findOneByOrFail({ id });
      const owner = await dataSource
        .getRepository(User)
        .findOneByOrFail({ username: credentials.username });

      expect(row.attachableId).toBe(owner.id);
    });

    it('writes the bytes under a name derived from the id, not the upload', async () => {
      const { token } = await register();

      const response = await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .attach('avatar', PNG, '../../etc/passwd')
        .expect(200);

      const id = attachmentIdOf((response.body as UserEnvelope).user.image);
      const row = await dataSource
        .getRepository(Attachment)
        .findOneByOrFail({ id });

      expect(row.storagePath).toBe(`user/${id}.png`);
      await expect(storage.exists(row.storagePath)).resolves.toBe(true);
    });

    it('accepts other fields alongside the file', async () => {
      const { token } = await register();

      const response = await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .field('user[bio]', 'uploaded with a bio')
        .attach('avatar', PNG, 'me.png')
        .expect(200);

      const { user } = response.body as UserEnvelope;
      expect(user.bio).toBe('uploaded with a bio');
      expect(user.image).toMatch(/^\/attachments\//);
    });

    it('validates multipart fields exactly like JSON ones', async () => {
      const { token } = await register();

      await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .field('user[email]', 'not-an-email')
        .attach('avatar', PNG, 'me.png')
        .expect(400);
    });

    it('trusts the bytes rather than the declared content type', async () => {
      const { token } = await register();

      const response = await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .attach('avatar', PNG, {
          filename: 'me.gif',
          contentType: 'image/gif',
        })
        .expect(200);

      const id = attachmentIdOf((response.body as UserEnvelope).user.image);
      const row = await dataSource
        .getRepository(Attachment)
        .findOneByOrFail({ id });

      expect(row.fileType).toBe('image/png');
      expect(row.storagePath.endsWith('.png')).toBe(true);
    });

    it('replaces the previous avatar rather than accumulating rows', async () => {
      const { credentials, token } = await register();

      await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .attach('avatar', PNG, 'first.png')
        .expect(200);

      await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .attach('avatar', GIF, 'second.gif')
        .expect(200);

      const owner = await dataSource
        .getRepository(User)
        .findOneByOrFail({ username: credentials.username });
      const rows = await dataSource
        .getRepository(Attachment)
        .findBy({ attachableType: 'User', attachableId: owner.id });

      expect(rows).toHaveLength(1);
      expect(rows[0].fileType).toBe('image/gif');
    });

    it('deletes the replaced file from disk', async () => {
      const { token } = await register();

      const first = await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .attach('avatar', PNG, 'first.png')
        .expect(200);

      const firstId = attachmentIdOf((first.body as UserEnvelope).user.image);

      await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .attach('avatar', GIF, 'second.gif')
        .expect(200);

      await expect(storage.exists(`user/${firstId}.png`)).resolves.toBe(false);
    });

    it('makes the old download URL 404 after a replacement', async () => {
      const { token } = await register();

      const first = await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .attach('avatar', PNG, 'first.png')
        .expect(200);

      const firstUrl = (first.body as UserEnvelope).user.image as string;

      await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .attach('avatar', GIF, 'second.gif')
        .expect(200);

      await request(app.getHttpServer())
        .get(firstUrl)
        .set('Authorization', `Token ${token}`)
        .expect(404);
    });

    it('rejects a file that is not an image', async () => {
      const { token } = await register();

      await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .attach('avatar', Buffer.from('#!/bin/sh\nrm -rf /'), {
          filename: 'evil.png',
          contentType: 'image/png',
        })
        .expect(415);
    });

    it('rejects SVG, which is markup rather than a raster image', async () => {
      const { token } = await register();

      await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .attach('avatar', Buffer.from('<svg onload="alert(1)"></svg>'), {
          filename: 'x.svg',
          contentType: 'image/svg+xml',
        })
        .expect(415);
    });

    it('stores nothing when the upload is rejected', async () => {
      const { credentials, token } = await register();

      await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .attach('avatar', Buffer.from('not an image'), 'evil.png')
        .expect(415);

      const owner = await dataSource
        .getRepository(User)
        .findOneByOrFail({ username: credentials.username });

      expect(owner.image).toBeNull();
      await expect(
        dataSource
          .getRepository(Attachment)
          .countBy({ attachableType: 'User', attachableId: owner.id }),
      ).resolves.toBe(0);
    });

    it('rejects a file larger than the configured limit', async () => {
      const { token } = await register();
      const tooBig = Buffer.concat([
        PNG,
        Buffer.alloc(storageConfig.maxFileSizeBytes + 1, 0x00),
      ]);

      await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .attach('avatar', tooBig, 'huge.png')
        .expect(413);
    });

    it('refuses a file and an image URL in the same request', async () => {
      const { token } = await register();

      await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .field('user[image]', 'https://example.com/a.png')
        .attach('avatar', PNG, 'me.png')
        .expect(400);
    });

    it('rejects an upload with no token', async () => {
      await request(app.getHttpServer())
        .put('/user')
        .attach('avatar', PNG, 'me.png')
        .expect(401);
    });
  });

  describe('GET /attachments/:id', () => {
    const uploadAvatar = async (token: string) => {
      const response = await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .attach('avatar', PNG, 'me.png')
        .expect(200);

      return (response.body as UserEnvelope).user.image as string;
    };

    it('returns the stored bytes with the detected type', async () => {
      const { token } = await register();
      const url = await uploadAvatar(token);

      const response = await request(app.getHttpServer())
        .get(url)
        .set('Authorization', `Token ${token}`)
        .expect(200)
        .expect('Content-Type', /image\/png/);

      expect(Buffer.from(response.body as Buffer).equals(PNG)).toBe(true);
    });

    it('sends the file name back in Content-Disposition', async () => {
      const { token } = await register();
      const url = await uploadAvatar(token);

      const response = await request(app.getHttpServer())
        .get(url)
        .set('Authorization', `Token ${token}`)
        .expect(200);

      expect(response.headers['content-disposition']).toContain('me.png');
    });

    it('marks the response as private so no shared cache keeps it', async () => {
      const { token } = await register();
      const url = await uploadAvatar(token);

      const response = await request(app.getHttpServer())
        .get(url)
        .set('Authorization', `Token ${token}`)
        .expect(200);

      expect(response.headers['cache-control']).toContain('private');
    });

    it('lets another signed-in user read the avatar', async () => {
      const owner = await register();
      const viewer = await register();
      const url = await uploadAvatar(owner.token);

      await request(app.getHttpServer())
        .get(url)
        .set('Authorization', `Token ${viewer.token}`)
        .expect(200);
    });

    it('refuses an anonymous caller', async () => {
      const { token } = await register();
      const url = await uploadAvatar(token);

      await request(app.getHttpServer()).get(url).expect(401);
    });

    it('refuses a revoked token', async () => {
      const { token } = await register();
      const url = await uploadAvatar(token);

      await request(app.getHttpServer())
        .post('/users/logout')
        .set('Authorization', `Token ${token}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(url)
        .set('Authorization', `Token ${token}`)
        .expect(401);
    });

    it('answers an unknown id with 404', async () => {
      const { token } = await register();

      await request(app.getHttpServer())
        .get(`/attachments/${randomUUID()}`)
        .set('Authorization', `Token ${token}`)
        .expect(404);
    });

    it('rejects an id that is not a UUID', async () => {
      const { token } = await register();

      await request(app.getHttpServer())
        .get('/attachments/not-a-uuid')
        .set('Authorization', `Token ${token}`)
        .expect(400);
    });

    it('cannot be talked into serving a file outside the upload root', async () => {
      const { token } = await register();

      await request(app.getHttpServer())
        .get('/attachments/..%2F..%2Fetc%2Fpasswd')
        .set('Authorization', `Token ${token}`)
        .expect(400);
    });
  });

  describe('GET /profiles/:username', () => {
    it('returns the public profile to an anonymous caller', async () => {
      const { credentials, token } = await register();

      await request(app.getHttpServer())
        .put('/user')
        .set('Authorization', `Token ${token}`)
        .send({ user: { bio: 'a public bio' } })
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/profiles/${credentials.username}`)
        .expect(200);

      const { profile } = response.body as ProfileEnvelope;
      expect(profile.username).toBe(credentials.username);
      expect(profile.bio).toBe('a public bio');
      expect(profile.following).toBe(false);
    });

    it('never leaks the email address', async () => {
      const { credentials } = await register();

      const response = await request(app.getHttpServer())
        .get(`/profiles/${credentials.username}`)
        .expect(200);

      expect(JSON.stringify(response.body)).not.toContain(credentials.email);
    });

    it('reports following false for a user you do not follow', async () => {
      const target = await register();
      const viewer = await register();

      const response = await request(app.getHttpServer())
        .get(`/profiles/${target.credentials.username}`)
        .set('Authorization', `Token ${viewer.token}`)
        .expect(200);

      expect((response.body as ProfileEnvelope).profile.following).toBe(false);
    });

    it('reports following true once you follow them', async () => {
      const target = await register();
      const viewer = await register();

      await request(app.getHttpServer())
        .post(`/profiles/${target.credentials.username}/follow`)
        .set('Authorization', `Token ${viewer.token}`)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/profiles/${target.credentials.username}`)
        .set('Authorization', `Token ${viewer.token}`)
        .expect(200);

      expect((response.body as ProfileEnvelope).profile.following).toBe(true);
    });

    it('still reports false to everyone else', async () => {
      const target = await register();
      const follower = await register();
      const stranger = await register();

      await request(app.getHttpServer())
        .post(`/profiles/${target.credentials.username}/follow`)
        .set('Authorization', `Token ${follower.token}`)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/profiles/${target.credentials.username}`)
        .set('Authorization', `Token ${stranger.token}`)
        .expect(200);

      expect((response.body as ProfileEnvelope).profile.following).toBe(false);
    });

    it('never reports you as following yourself', async () => {
      const { credentials, token } = await register();

      const response = await request(app.getHttpServer())
        .get(`/profiles/${credentials.username}`)
        .set('Authorization', `Token ${token}`)
        .expect(200);

      expect((response.body as ProfileEnvelope).profile.following).toBe(false);
    });

    it('answers an unknown username with 404', async () => {
      await request(app.getHttpServer())
        .get('/profiles/nobody-at-all')
        .expect(404);
    });

    it('rejects a token that is present but invalid', async () => {
      const { credentials } = await register();

      await request(app.getHttpServer())
        .get(`/profiles/${credentials.username}`)
        .set('Authorization', 'Token not.a.real.token')
        .expect(401);
    });

    it('rejects a token that has been revoked', async () => {
      const target = await register();
      const viewer = await register();

      await request(app.getHttpServer())
        .post('/users/logout')
        .set('Authorization', `Token ${viewer.token}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/profiles/${target.credentials.username}`)
        .set('Authorization', `Token ${viewer.token}`)
        .expect(401);
    });

    it('localises the not-found message', async () => {
      const response = await request(app.getHttpServer())
        .get('/profiles/nobody-at-all?lang=jp')
        .expect(404);

      expect((response.body as { message: string }).message).toContain(
        'ユーザー',
      );
    });
  });

  describe('POST /profiles/:username/follow', () => {
    it('follows the user and says so', async () => {
      const target = await register();
      const viewer = await register();

      const response = await request(app.getHttpServer())
        .post(`/profiles/${target.credentials.username}/follow`)
        .set('Authorization', `Token ${viewer.token}`)
        .expect(200);

      expect((response.body as ProfileEnvelope).profile.following).toBe(true);
    });

    it('records exactly one edge', async () => {
      const target = await register();
      const viewer = await register();

      await request(app.getHttpServer())
        .post(`/profiles/${target.credentials.username}/follow`)
        .set('Authorization', `Token ${viewer.token}`)
        .expect(200);

      const users = dataSource.getRepository(User);
      const [followed, follower] = await Promise.all([
        users.findOneByOrFail({ username: target.credentials.username }),
        users.findOneByOrFail({ username: viewer.credentials.username }),
      ]);

      await expect(
        dataSource.getRepository(UserFollow).countBy({
          followerId: follower.id,
          followingId: followed.id,
        }),
      ).resolves.toBe(1);
    });

    it('is idempotent', async () => {
      const target = await register();
      const viewer = await register();

      await request(app.getHttpServer())
        .post(`/profiles/${target.credentials.username}/follow`)
        .set('Authorization', `Token ${viewer.token}`)
        .expect(200);

      const response = await request(app.getHttpServer())
        .post(`/profiles/${target.credentials.username}/follow`)
        .set('Authorization', `Token ${viewer.token}`)
        .expect(200);

      expect((response.body as ProfileEnvelope).profile.following).toBe(true);
    });

    it('still records only one edge after following twice', async () => {
      const target = await register();
      const viewer = await register();

      for (let attempt = 0; attempt < 2; attempt += 1) {
        await request(app.getHttpServer())
          .post(`/profiles/${target.credentials.username}/follow`)
          .set('Authorization', `Token ${viewer.token}`)
          .expect(200);
      }

      const users = dataSource.getRepository(User);
      const [followed, follower] = await Promise.all([
        users.findOneByOrFail({ username: target.credentials.username }),
        users.findOneByOrFail({ username: viewer.credentials.username }),
      ]);

      await expect(
        dataSource.getRepository(UserFollow).countBy({
          followerId: follower.id,
          followingId: followed.id,
        }),
      ).resolves.toBe(1);
    });

    it('refuses to let you follow yourself', async () => {
      const { credentials, token } = await register();

      await request(app.getHttpServer())
        .post(`/profiles/${credentials.username}/follow`)
        .set('Authorization', `Token ${token}`)
        .expect(422);
    });

    it('answers an unknown username with 404', async () => {
      const { token } = await register();

      await request(app.getHttpServer())
        .post('/profiles/nobody-at-all/follow')
        .set('Authorization', `Token ${token}`)
        .expect(404);
    });

    it('rejects an anonymous caller', async () => {
      const target = await register();

      await request(app.getHttpServer())
        .post(`/profiles/${target.credentials.username}/follow`)
        .expect(401);
    });

    it('localises the self-follow message', async () => {
      const { credentials, token } = await register();

      const response = await request(app.getHttpServer())
        .post(`/profiles/${credentials.username}/follow?lang=jp`)
        .set('Authorization', `Token ${token}`)
        .expect(422);

      expect((response.body as { message: string }).message).toContain(
        'フォロー',
      );
    });
  });

  describe('DELETE /profiles/:username/follow', () => {
    it('unfollows the user and says so', async () => {
      const target = await register();
      const viewer = await register();

      await request(app.getHttpServer())
        .post(`/profiles/${target.credentials.username}/follow`)
        .set('Authorization', `Token ${viewer.token}`)
        .expect(200);

      const response = await request(app.getHttpServer())
        .delete(`/profiles/${target.credentials.username}/follow`)
        .set('Authorization', `Token ${viewer.token}`)
        .expect(200);

      expect((response.body as ProfileEnvelope).profile.following).toBe(false);
    });

    it('removes the edge', async () => {
      const target = await register();
      const viewer = await register();

      await request(app.getHttpServer())
        .post(`/profiles/${target.credentials.username}/follow`)
        .set('Authorization', `Token ${viewer.token}`)
        .expect(200);
      await request(app.getHttpServer())
        .delete(`/profiles/${target.credentials.username}/follow`)
        .set('Authorization', `Token ${viewer.token}`)
        .expect(200);

      const users = dataSource.getRepository(User);
      const [followed, follower] = await Promise.all([
        users.findOneByOrFail({ username: target.credentials.username }),
        users.findOneByOrFail({ username: viewer.credentials.username }),
      ]);

      await expect(
        dataSource.getRepository(UserFollow).countBy({
          followerId: follower.id,
          followingId: followed.id,
        }),
      ).resolves.toBe(0);
    });

    it('is idempotent', async () => {
      const target = await register();
      const viewer = await register();

      await request(app.getHttpServer())
        .delete(`/profiles/${target.credentials.username}/follow`)
        .set('Authorization', `Token ${viewer.token}`)
        .expect(200);
    });

    it('leaves other followers alone', async () => {
      const target = await register();
      const staying = await register();
      const leaving = await register();

      for (const follower of [staying, leaving]) {
        await request(app.getHttpServer())
          .post(`/profiles/${target.credentials.username}/follow`)
          .set('Authorization', `Token ${follower.token}`)
          .expect(200);
      }

      await request(app.getHttpServer())
        .delete(`/profiles/${target.credentials.username}/follow`)
        .set('Authorization', `Token ${leaving.token}`)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/profiles/${target.credentials.username}`)
        .set('Authorization', `Token ${staying.token}`)
        .expect(200);

      expect((response.body as ProfileEnvelope).profile.following).toBe(true);
    });

    it('refuses to let you unfollow yourself', async () => {
      const { credentials, token } = await register();

      await request(app.getHttpServer())
        .delete(`/profiles/${credentials.username}/follow`)
        .set('Authorization', `Token ${token}`)
        .expect(422);
    });

    it('answers an unknown username with 404', async () => {
      const { token } = await register();

      await request(app.getHttpServer())
        .delete('/profiles/nobody-at-all/follow')
        .set('Authorization', `Token ${token}`)
        .expect(404);
    });

    it('rejects an anonymous caller', async () => {
      const target = await register();

      await request(app.getHttpServer())
        .delete(`/profiles/${target.credentials.username}/follow`)
        .expect(401);
    });
  });

  describe('database schema', () => {
    it('was created by the Pull 3 migrations', async () => {
      const applied = await dataSource.query<{ name: string }[]>(
        'SELECT name FROM migrations ORDER BY timestamp',
      );
      const names = applied.map((row) => row.name);

      expect(names).toContain('CreateAttachmentsTable1758000000000');
      expect(names).toContain('CreateUserFollowsTable1758000100000');
    });

    it('refuses a self-follow even when inserted directly', async () => {
      const { credentials } = await register();
      const user = await dataSource
        .getRepository(User)
        .findOneByOrFail({ username: credentials.username });

      await expect(
        dataSource
          .getRepository(UserFollow)
          .insert({ followerId: user.id, followingId: user.id }),
      ).rejects.toThrow();
    });

    it('takes the follow edges with the user when one is deleted', async () => {
      const target = await register();
      const viewer = await register();

      await request(app.getHttpServer())
        .post(`/profiles/${target.credentials.username}/follow`)
        .set('Authorization', `Token ${viewer.token}`)
        .expect(200);

      const users = dataSource.getRepository(User);
      const follower = await users.findOneByOrFail({
        username: viewer.credentials.username,
      });

      await users.delete({ id: follower.id });

      await expect(
        dataSource
          .getRepository(UserFollow)
          .countBy({ followerId: follower.id }),
      ).resolves.toBe(0);
    });
  });
});
