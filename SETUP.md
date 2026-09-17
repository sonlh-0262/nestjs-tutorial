# Local setup guide

---

## Option A - Docker only (no Node needed)

Requires Docker Desktop (Compose v2).

```bash
# 1. Create your env file
cp .env.example .env

# 2. Build and start the API, Postgres and Redis
#    (first build takes a few minutes)
docker compose up --build -d

# 3. Create the schema
docker compose exec api npm run migration:run
```

The API is on <http://localhost:3000>, Swagger UI on
<http://localhost:3000/api>.

`docker compose up` starts three services: `api`, `postgres` and `redis`. The
API waits for both of the others to report healthy before it starts.

Source is bind-mounted, so editing a file under `src/` (including the
translation files in `src/i18n/`) reloads the server automatically, typically
within a few seconds.

### Everyday commands

```bash
docker compose up -d           # start in the background
docker compose logs -f api     # follow logs
docker compose ps              # status (incl. health)
docker compose down            # stop and remove
docker compose down -v         # also drop volumes
docker compose build --no-cache  # rebuild after changing package.json
```

### Running npm scripts inside the container

```bash
docker compose exec api npm run lint
docker compose exec api npm test
docker compose exec api npm run test:e2e
docker compose exec api npm run build
```

If the container is not running, use a one-off container instead:

```bash
docker compose run --rm api npm test
```

> **After changing `package.json`**, dependencies live inside the image, so
> rebuild: `docker compose up --build`.

### Production image

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

This runs the compiled `dist/` output as a non-root user, with Swagger disabled.

---

## Option B - Local Node

Requires **Node.js >= 20** (22 LTS recommended) and npm.

Install Node from <https://nodejs.org>, or with a version manager:

```powershell
# Windows (winget)
winget install OpenJS.NodeJS.LTS

# or nvm-windows
nvm install 22
nvm use 22
```

```bash
# 1. Env file
cp .env.example .env         # Windows PowerShell: copy .env.example .env

# 2. Start the database and cache (the API itself runs on the host)
docker compose up -d postgres redis

#    ...and point the app at them - in .env set:
#      DB_HOST=localhost
#      REDIS_HOST=localhost

# 3. Dependencies
npm install

# 4. Create the schema
npm run migration:run

# 5. Start in watch mode
npm run start:dev
```

- API: <http://localhost:3000>
- Swagger UI: <http://localhost:3000/api>
- OpenAPI JSON: <http://localhost:3000/api-json>

### Database migrations

The schema is created only by migrations - `synchronize` is off everywhere.

```bash
npm run migration:run      # apply everything pending
npm run migration:show     # what is applied, what is not
npm run migration:revert   # undo the last one
npm run migration:reset    # drop the schema and re-apply from scratch

# new migration, written by hand
npm run migration:create -- src/database/migrations/AddSomething

# new migration, generated from the difference against the entities
npm run migration:generate -- src/database/migrations/AddSomething
```

On a clean tree `migration:generate` must report *"No changes in database
schema were found"*. If it writes a file instead, an entity was changed without
a matching migration.

### Verify everything passes

```bash
npm run lint         # ESLint - must report no errors
npm run format:check # Prettier - formatting check
npm test             # unit tests
npm run test:e2e     # end-to-end tests
npm run build        # compiles to dist/
```

### Debugging

```bash
npm run start:debug   # inspector on 0.0.0.0:9229
```

In VS Code, attach with "Node.js: Attach" on port 9229. The Docker dev service
publishes 9229 as well, so the same works against the container.

---

## Environment variables

| Variable            | Default            | Description                                   |
| ------------------- | ------------------ | --------------------------------------------- |
| `NODE_ENV`          | `development`      | `development` \| `production` \| `test`       |
| `PORT`              | `3000`             | HTTP port                                     |
| `APP_NAME`          | `NestJS Tutorial API` | Title shown in Swagger                     |
| `API_PREFIX`        | _(empty)_          | Optional global route prefix, e.g. `api/v1`   |
| `SWAGGER_ENABLED`   | on outside prod    | `true` / `false`                              |
| `SWAGGER_PATH`      | `api`              | Where the Swagger UI is mounted               |
| `FALLBACK_LANGUAGE` | `en`               | Language used when the requested one is unknown; must be `en` or `jp` |

### Database

| Variable       | Default           | Description                                      |
| -------------- | ----------------- | ------------------------------------------------ |
| `DB_HOST`      | `localhost`       | `postgres` inside docker compose                 |
| `DB_PORT`      | `5432`            | Port the API connects to                         |
| `DB_USERNAME`  | `postgres`        |                                                  |
| `DB_PASSWORD`  | `postgres`        | May be empty for `trust` authentication          |
| `DB_DATABASE`  | `nestjs_tutorial` |                                                  |
| `DB_SCHEMA`    | `public`          |                                                  |
| `DB_SSL`       | `false`           | `true` enables TLS                               |
| `DB_LOGGING`   | `false`           | `true` logs every SQL statement                  |
| `DB_HOST_PORT` | `5432`            | Compose only: host port Postgres is published on |

### Redis

| Variable           | Default            | Description                                   |
| ------------------ | ------------------ | --------------------------------------------- |
| `REDIS_HOST`       | `localhost`        | `redis` inside docker compose                 |
| `REDIS_PORT`       | `6379`             | Port the API connects to                      |
| `REDIS_PASSWORD`   | _(empty)_          | Empty means no authentication                 |
| `REDIS_DB`         | `0`                | 0-15                                          |
| `REDIS_KEY_PREFIX` | `nestjs-tutorial:` | Namespaces every key                          |
| `REDIS_HOST_PORT`  | `6379`             | Compose only: host port Redis is published on |

### Authentication

| Variable             | Default             | Description                                             |
| -------------------- | ------------------- | ------------------------------------------------------- |
| `JWT_SECRET`         | dev fallback        | **Required when `NODE_ENV=production`**, min 32 chars   |
| `JWT_EXPIRES_IN`     | `1d`                | `ms`-style duration: `60`, `30s`, `15m`, `1d`, `2w`     |
| `JWT_ISSUER`         | `nestjs-tutorial`   | Written into, and verified on, every token              |
| `BCRYPT_SALT_ROUNDS` | `10`                | 4-31. Use 4 in tests, 10 or more in production          |

Generate a production secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Invalid values fail fast at startup with a clear message (see
`src/config/env.validation.ts`).

---

## Smoke test

```bash
curl http://localhost:3000/
# {"message":"Hello World!","language":"en"}

curl "http://localhost:3000/?lang=jp"
# {"message":"こんにちは世界！","language":"jp"}

# Browsers send the ISO code `ja`, which maps onto the `jp` catalogue
curl -H "Accept-Language: ja-JP" http://localhost:3000/health
# {"status":"ok","message":"サービスは正常に稼働しています",...}
```

### Authentication

```bash
# Register - the response carries the access token; copy it into TOKEN
curl -X POST http://localhost:3000/users \
  -H 'Content-Type: application/json' \
  -d '{"user":{"username":"jake","email":"jake@jake.jake","password":"Sup3rS3cret!"}}'

TOKEN=...   # the "token" value from the response above

# Current user  (`Bearer` is accepted as well as `Token`)
curl http://localhost:3000/user -H "Authorization: Token $TOKEN"
# {"user":{"email":"jake@jake.jake","username":"jake","bio":null,"image":null}}

# Log out, then try again - the token is dead
curl -X POST http://localhost:3000/users/logout -H "Authorization: Token $TOKEN"
curl -i http://localhost:3000/user -H "Authorization: Token $TOKEN"
# HTTP/1.1 401 Unauthorized
```

---

## Troubleshooting

| Symptom                                    | Fix                                                             |
| ------------------------------------------ | --------------------------------------------------------------- |
| `Port 3000 is already in use`              | Set `PORT=3001` in `.env`, or stop the other process             |
| Edits not picked up in Docker              | Confirm `CHOKIDAR_USEPOLLING`/`TSC_WATCHFILE` are still set in `docker-compose.yml`; they make the watchers poll the bind mount |
| Translations not updating                  | They are copied to `dist/i18n` by the Nest CLI asset step; `npm run build` (or restart the container) if they look stale |
| `Cannot find module` after `git pull`      | `npm install` (or `docker compose up --build`)                   |
| Host `node_modules` shadowing the container | Already handled by the anonymous volume in `docker-compose.yml`  |
| Windows line-ending warnings from git      | Handled by `.gitattributes` (`* text=auto eol=lf`); run `git add --renormalize .` once if an old checkout still shows CRLF |
| `Port 5432` or `6379` already in use        | Another project holds it. Set `DB_HOST_PORT` / `REDIS_HOST_PORT` in `.env` - these change only the **host** port, not the one the API uses |
| `relation "users" does not exist`           | The schema was never created: `npm run migration:run`           |
| `ECONNREFUSED` to Postgres or Redis         | `docker compose up -d postgres redis`, and set `DB_HOST=localhost` / `REDIS_HOST=localhost` when the API runs on the host |
| Logout appears not to work                 | Check Redis is reachable - the denylist lives there, so without it a token stays valid until it expires |
