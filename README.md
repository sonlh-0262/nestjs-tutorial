# NestJS Tutorial API

## Stack

| Concern    | Choice                                   |
| ---------- | ---------------------------------------- |
| Framework  | NestJS 11 (CommonJS)                     |
| Language   | TypeScript 5.9                           |
| i18n       | `nestjs-i18n` (en / jp)                  |
| API docs   | `@nestjs/swagger` (OpenAPI 3) at `/api`  |
| Validation | `class-validator` + `class-transformer`  |
| Lint       | ESLint 10 (flat config) + Prettier       |
| Tests      | Jest (unit) + Supertest (e2e)            |
| Runtime    | Node 22 / Docker + Docker Compose        |

## Endpoints

| Method | Path        | Description                              |
| ------ | ----------- | ---------------------------------------- |
| GET    | `/`         | Localised hello world, optional `?name=` |
| GET    | `/health`   | Health check (used by the Docker probe)  |
| GET    | `/api`      | Swagger UI                               |
| GET    | `/api-json` | Raw OpenAPI JSON document                |

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

## Running locally

Two supported ways: with Docker (nothing but Docker required) or with a local
Node installation. See `SETUP.md` for step-by-step instructions.

```bash
cp .env.example .env

# Option A - Docker
docker compose up --build

# Option B - local Node (>= 20)
npm install
npm run start:dev
```

Then open <http://localhost:3000/api> for the Swagger UI.

## npm scripts

| Script                | What it does                           |
| --------------------- | -------------------------------------- |
| `npm run start:dev`   | Watch mode                             |
| `npm run build`       | Compile to `dist/`                     |
| `npm run start:prod`  | Run the compiled build                 |
| `npm run lint`        | ESLint (fails on any error)            |
| `npm run lint:fix`    | ESLint with autofix                    |
| `npm run format`      | Prettier write                         |
| `npm test`            | Unit tests                             |
| `npm run test:e2e`    | End-to-end tests                       |
| `npm run test:cov`    | Unit tests with coverage               |

## Project layout

```
src/
├── app.controller.ts          # GET / and GET /health
├── app.service.ts             # Builds localised responses
├── app.module.ts              # Wires ConfigModule + I18nModule
├── main.ts                    # Bootstrap
├── common/
│   ├── constants/
│   │   └── languages.ts       # Supported languages (single source of truth)
│   └── dto/
│       └── lang-query.dto.ts  # Base query DTO allowing ?lang / ?l
├── config/
│   ├── app-setup.ts           # Pipes/filters shared by main.ts and e2e tests
│   ├── configuration.ts       # Typed config namespace
│   ├── env.validation.ts      # Fail-fast env var validation
│   └── swagger.ts             # OpenAPI document
├── dto/                       # Request/response DTOs
└── i18n/{en,jp}/              # Translation files
```
