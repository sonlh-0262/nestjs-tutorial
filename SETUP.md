# Local setup guide

---

## Option A - Docker only (no Node needed)

Requires Docker Desktop (Compose v2).

```bash
# 1. Create your env file
cp .env.example .env

# 2. Build and start (first build takes a few minutes)
docker compose up --build
```

The API is on <http://localhost:3000>, Swagger UI on
<http://localhost:3000/api>.

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

# 2. Dependencies
npm install

# 3. Start in watch mode
npm run start:dev
```

- API: <http://localhost:3000>
- Swagger UI: <http://localhost:3000/api>
- OpenAPI JSON: <http://localhost:3000/api-json>

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

---

## Troubleshooting

| Symptom                                    | Fix                                                             |
| ------------------------------------------ | --------------------------------------------------------------- |
| `Port 3000 is already in use`              | Set `PORT=3001` in `.env`, or stop the other process             |
| Edits not picked up in Docker              | Confirm `CHOKIDAR_USEPOLLING`/`TSC_WATCHFILE` are still set in `docker-compose.yml`; they make the watchers poll the bind mount |
| Translations not updating                  | They are copied to `dist/i18n` by the Nest CLI asset step; `npm run build` (or restart the container) if they look stale |
| `Cannot find module` after `git pull`      | `npm install` (or `docker compose up --build`)                   |
| Host `node_modules` shadowing the container | Already handled by the anonymous volume in `docker-compose.yml`  |
| Windows line-ending warnings from git      | `git config core.autocrlf input`                                 |
