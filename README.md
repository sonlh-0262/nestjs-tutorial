# NestJS Tutorial API

## Stack

| Concern    | Choice                                       |
| ---------- | -------------------------------------------- |
| Framework  | NestJS 11 (CommonJS)                         |
| Language   | TypeScript 5.9                               |
| Database   | PostgreSQL 16 + TypeORM 0.3 (manual migrations) |
| Cache      | Redis 7 (`ioredis`) — access-token denylist  |
| Auth       | JWT (`@nestjs/jwt` + `passport-jwt`), bcrypt |
| i18n       | `nestjs-i18n` (en / jp)                      |
| API docs   | `@nestjs/swagger` (OpenAPI 3) at `/api`      |
| Validation | `class-validator` + `class-transformer`      |
| Lint       | ESLint 10 (flat config) + Prettier           |
| Tests      | Jest (unit) + Supertest (e2e)                |
| CI         | GitHub Actions (`.github/workflows/ci.yml`)  |
| Runtime    | Node 22 / Docker + Docker Compose            |

## Endpoints

| Method | Path            | Auth | Description                              |
| ------ | --------------- | ---- | ---------------------------------------- |
| GET    | `/`             | —    | Localised hello world, optional `?name=` |
| GET    | `/health`       | —    | Health check (used by the Docker probe)  |
| POST   | `/users`        | —    | Register, returns the user and a token   |
| POST   | `/users/login`  | —    | Log in, returns the user and a token     |
| POST   | `/users/logout` | yes  | Revoke the token used for the request    |
| GET    | `/user`         | yes  | Get the current user                     |
| GET    | `/api`          | —    | Swagger UI                               |
| GET    | `/api-json`     | —    | Raw OpenAPI JSON document                |

Payloads follow the [RealWorld](https://realworld-docs.netlify.app/specifications/backend/endpoints/)
spec, so every user body is wrapped in a `user` envelope.

```bash
# Register
curl -X POST http://localhost:3000/users \
  -H 'Content-Type: application/json' \
  -d '{"user":{"username":"jake","email":"jake@jake.jake","password":"Sup3rS3cret!"}}'

# Log in
curl -X POST http://localhost:3000/users/login \
  -H 'Content-Type: application/json' \
  -d '{"user":{"email":"jake@jake.jake","password":"Sup3rS3cret!"}}'

# Current user  (`Bearer` works too)
curl http://localhost:3000/user -H "Authorization: Token $TOKEN"

# Log out - the token stops working immediately
curl -X POST http://localhost:3000/users/logout -H "Authorization: Token $TOKEN"
```

### How logout works

A JWT is self-contained, so it stays cryptographically valid until it expires
and "logging out" cannot simply forget it. On logout the token's `jti` claim is
written to a Redis key with a TTL equal to the token's own remaining lifetime,
and `JwtStrategy` checks that denylist on every authenticated request. The
entry therefore disappears exactly when the token would have expired anyway, so
the denylist cannot grow without bound.

Because the denylist is keyed by `jti` rather than by user, logging out of one
device leaves the user's other sessions signed in.

### Choosing a language

Supported languages are **`en`** and **`jp`**. The language is resolved in
this order:

1. Query string — `?lang=jp` (or the short alias `?l=jp`)
2. Header — `x-lang: jp`
3. Header — `Accept-Language: ja`

Browsers send the ISO 639-1 code `ja` (and `ja-JP`) rather than `jp`, so both
are mapped onto the `jp` catalogue — see `LANGUAGE_FALLBACKS` in
`src/common/constants/languages.ts`. Anything unsupported falls back to
`FALLBACK_LANGUAGE` (default `en`), and the `language` field of the response
always reports the language the body is actually written in.

```bash
curl http://localhost:3000/                            # Hello World!
curl "http://localhost:3000/?lang=jp"                  # こんにちは世界！
curl -H "Accept-Language: ja" http://localhost:3000/   # こんにちは世界！
curl "http://localhost:3000/?name=Son&lang=jp"         # こんにちは、Sonさん！
```

Authentication errors are localised too, so `POST /users/login?lang=jp` answers
a bad password in Japanese.

## Running locally

Two supported ways: with Docker (nothing but Docker required) or with a local
Node installation. See `SETUP.md` for step-by-step instructions.

```bash
cp .env.example .env

# Option A - Docker (also starts Postgres and Redis)
docker compose up --build -d
docker compose exec api npm run migration:run

# Option B - local Node (>= 20), against the compose database
docker compose up -d postgres redis
npm install
npm run migration:run
npm run start:dev
```

Then open <http://localhost:3000/api> for the Swagger UI.

## Database migrations

The schema is owned by hand-written migrations in `src/database/migrations/`.
`synchronize` is off in every environment, so the only way the schema changes
is by a migration that was reviewed in a pull request.

| Script                                              | What it does                             |
| --------------------------------------------------- | ---------------------------------------- |
| `npm run migration:create -- src/database/migrations/Name` | New empty migration            |
| `npm run migration:generate -- src/database/migrations/Name` | Generate one from the entity diff |
| `npm run migration:run`                             | **Apply** everything pending             |
| `npm run migration:revert`                          | **Revert** the last applied migration    |
| `npm run migration:reset`                           | **Reset**: drop the schema and re-apply  |
| `npm run migration:show`                            | Which migrations are applied             |

All of them read `src/database/data-source.ts`, which builds its options with
the same `buildDataSourceOptions()` the running application uses — so a
migration generated by the CLI always describes the schema the app connects to.

> Running `migration:generate` on a clean tree should print *"No changes in
> database schema were found"*. Anything else means an entity was changed
> without a matching migration. CI checks this on every pull request.

## npm scripts

| Script                | What it does                           |
| --------------------- | -------------------------------------- |
| `npm run start:dev`   | Watch mode                             |
| `npm run build`       | Compile to `dist/`                     |
| `npm run start:prod`  | Run the compiled build                 |
| `npm run lint`        | ESLint (fails on any error)            |
| `npm run lint:fix`    | ESLint with autofix                    |
| `npm run format`      | Prettier write                         |
| `npm run format:check`| Prettier check (what CI runs)          |
| `npm test`            | Unit tests                             |
| `npm run test:e2e`    | End-to-end tests (needs Postgres+Redis)|
| `npm run test:cov`    | Unit tests with coverage               |

## Project layout

```
src/
├── app.controller.ts          # GET / and GET /health
├── app.service.ts             # Builds localised responses
├── app.module.ts              # Wires Config, I18n, Database, Redis, Users, Auth
├── main.ts                    # Bootstrap
├── auth/
│   ├── auth.controller.ts     # POST /users, /users/login, /users/logout
│   ├── auth.service.ts        # Register, login, logout, password hashing
│   ├── token-blacklist.service.ts  # Redis-backed access-token denylist
│   ├── dto/                   # Register / login request DTOs
│   ├── guards/                # JwtAuthGuard
│   ├── interfaces/            # JwtPayload, AuthenticatedUser
│   └── strategies/            # JwtStrategy (signature + denylist + user check)
├── users/
│   ├── users.controller.ts    # GET /user
│   ├── users.service.ts       # All reads and writes of the users table
│   ├── dto/user.dto.ts        # Public projection + `user` envelope
│   └── entities/user.entity.ts
├── database/
│   ├── data-source.ts         # DataSource for the TypeORM CLI
│   ├── data-source-options.ts # Options shared by the CLI and the app
│   ├── database.module.ts     # TypeOrmModule.forRootAsync
│   └── migrations/            # Hand-written schema migrations
├── redis/
│   ├── redis.module.ts        # Shared ioredis connection (global)
│   └── redis.constants.ts
├── common/
│   ├── constants/languages.ts # Supported languages (single source of truth)
│   ├── decorators/            # @CurrentUser()
│   ├── dto/lang-query.dto.ts  # Base query DTO allowing ?lang / ?l
│   └── resolvers/             # Accept-Language alias resolver
├── config/
│   ├── app-setup.ts           # Pipes/filters shared by main.ts and e2e tests
│   ├── configuration.ts       # Typed app config namespace
│   ├── auth.config.ts         # JWT + bcrypt settings
│   ├── database.config.ts     # PostgreSQL settings
│   ├── redis.config.ts        # Redis settings
│   ├── env.validation.ts      # Fail-fast env var validation
│   └── swagger.ts             # OpenAPI document
├── dto/                       # Hello / health DTOs
└── i18n/{en,jp}/              # Translation files (common, validation, auth)
```
