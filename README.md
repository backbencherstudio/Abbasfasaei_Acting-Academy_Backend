# Acting Academy Backend

Production-oriented NestJS backend for the Acting Academy platform. The service provides authentication, course/enrollment workflows, payments (Stripe), chat/realtime communication, community features, attendance, dashboard, and admin operations.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Core Features](#core-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Local Development Setup](#local-development-setup)
- [Run Commands](#run-commands)
- [Database and Seeding](#database-and-seeding)
- [API Documentation](#api-documentation)
- [Realtime, TURN, and LiveKit](#realtime-turn-and-livekit)
- [Stripe Webhook](#stripe-webhook)
- [Docker and Infrastructure](#docker-and-infrastructure)
- [Production Deployment Notes](#production-deployment-notes)
- [Testing and Quality](#testing-and-quality)
- [Troubleshooting](#troubleshooting)

## Architecture Overview

- Framework: NestJS 11
- Language: TypeScript
- ORM: Prisma
- Database: PostgreSQL
- Queue and cache: BullMQ + Redis
- Realtime: Socket.IO + LiveKit + Coturn
- Storage: Local disk and S3-compatible storage (MinIO/AWS S3)

The application runs with global `/api` prefix (except root `/`) and serves:

- API routes at `/api/*`
- Swagger at `/api/docs` (unless disabled)
- Static frontend under `/frontend`
- Static site from `public/site`

## Core Features

- Authentication and authorization (JWT + role/permission model)
- User and profile management
- Course management, modules, classes, assignments, and grading
- Enrollment and payment lifecycle
- Stripe one-time and subscription payments
- Community posts, comments, likes, shares, polls, and user reporting
- Chat, conversations, messaging, uploads, and RTC support
- Attendance and QR attendance sessions
- Events and website/admin content management
- Finance and dashboard modules

## Tech Stack

- Node.js 20+
- NestJS
- Prisma + `@prisma/client`
- PostgreSQL
- Redis
- BullMQ
- Socket.IO
- Stripe
- LiveKit
- Coturn
- Swagger (`@nestjs/swagger`)

## Project Structure

```text
src/
	app.module.ts
	main.ts
	modules/
		auth/
		admin/
		application/
		attendance/
		chat/
		community/
		course/
		dashboard/
		enrollment/
		events/
		finance/
		financeandpayments/
		home/
		payment/
	command/
		seed.command.ts
	config/
		app.config.ts
prisma/
	schema.prisma
	migrations/
docker-compose.yml
Dockerfile
livekit/
dockerfiles/coturn/
public/
```

## Prerequisites

- Node.js 20+
- Yarn 1.x
- PostgreSQL
- Redis
- Stripe CLI (optional, for webhook testing)
- Docker (optional, recommended for local infra)

## Environment Configuration

This repository currently includes `.env` but no committed `.env.example`. Create/update `.env` based on the keys used in `src/config/app.config.ts`.

### Required Core Variables

```env
APP_NAME=
APP_KEY=
APP_URL=
CLIENT_APP_URL=
PORT=4000

DATABASE_URL=postgresql://user:password@localhost:5432/dbname

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=

JWT_SECRET=
JWT_EXPIRY=

SYSTEM_USERNAME=
SYSTEM_EMAIL=
SYSTEM_PASSWORD=
```

### Payment Variables

```env
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

PAYPAL_CLIENT_ID=
PAYPAL_SECRET=
PAYPAL_API=
```

### Mail Variables

```env
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_FROM_ADDRESS=
```

### OAuth Variables

```env
GOOGLE_APP_ID=
GOOGLE_APP_SECRET=
GOOGLE_CALLBACK_URL=
```

### Storage Variables

```env
STORAGE_DRIVER=local

AWS_S3_BUCKET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_ENDPOINT=
AWS_S3_FORCE_PATH_STYLE=false

MINIO_BUCKET=
MINIO_ENDPOINT=
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
MINIO_PORT=
MINIO_USE_SSL=false
```

### Optional Runtime Flags

```env
ENABLE_SWAGGER=true
LIVEKIT_API_KEY=devkey
LIVEKIT_API_SECRET=devsecret
```

## Local Development Setup

1. Install dependencies.

```bash
yarn install
```

2. Start infrastructure (Redis, MinIO, TURN, LiveKit).

```bash
docker compose up -d
```

3. Run migrations.

```bash
yarn db:migrate
```

4. Generate Prisma client.

```bash
yarn db:generate
```

5. Seed base data.

```bash
yarn cmd seed
```

6. Start application in development mode.

```bash
yarn start:dev-swc
```

## Run Commands

```bash
# build
yarn build

# run
yarn start
yarn start:dev
yarn start:dev-swc
yarn start:debug
yarn start:prod

# db
yarn db:generate
yarn db:migrate
yarn db:studio

# utilities
yarn cmd seed
```

## Database and Seeding

- Prisma schema: `prisma/schema.prisma`
- Migrations: `prisma/migrations/`
- Seed command entry: `src/command/seed.command.ts`

Seed command creates:

- default roles (`Super Admin`, `Admin`, `Project Manager`, `Member`, `Viewer`, `Teacher`, `Student`)
- default permission sets and role-permission mappings
- system admin user from `SYSTEM_USERNAME`, `SYSTEM_EMAIL`, `SYSTEM_PASSWORD`

## API Documentation

- Swagger UI: `http://localhost:4000/api/docs`
- Root health response: `GET /` returns `{ ok: true, message: 'Server is running' }`

To disable Swagger generation:

```env
ENABLE_SWAGGER=false
```

## Realtime, TURN, and LiveKit

Local realtime dependencies are pre-defined in `docker-compose.yml`:

- Redis: `6379`
- Coturn: `3478`, `5349`, media relay UDP range `55000-55050`
- LiveKit: `7880`, `7881`, UDP range `55100-55150`

LiveKit template is available at `livekit/livekit.example.yaml`.

## Stripe Webhook

Webhook endpoint:

```text
POST /api/payment/stripe/webhook
```

Forward events in development:

```bash
stripe listen --forward-to localhost:4000/api/payment/stripe/webhook
```

Trigger a test event:

```bash
stripe trigger payment_intent.succeeded
```

## Docker and Infrastructure

`docker-compose.yml` in this repository provisions infrastructure services only (MinIO, Redis, Coturn, LiveKit).

The app container `Dockerfile` currently defaults to:

```bash
yarn start:dev-swc
```

For production containers, prefer immutable build + `yarn start:prod`.

## Production Deployment Notes

- Use managed PostgreSQL and Redis in production.
- Set strict CORS origins (avoid `*`).
- Keep `ENABLE_SWAGGER=false` in production unless intentionally public.
- Store secrets in a secret manager, not in `.env` committed files.
- Use HTTPS/TLS termination at reverse proxy or load balancer.
- Run `yarn build` in CI and deploy `dist/` with `yarn start:prod`.
- Ensure Stripe webhook secret is environment-specific.
- Configure S3/MinIO credentials if using `STORAGE_DRIVER=s3`.

## Testing and Quality

```bash
# unit
yarn test

# e2e
yarn test:e2e

# coverage
yarn test:cov

# lint
yarn lint

# format
yarn format
```

## Troubleshooting

- Prisma client generation fails on Windows with `EPERM` DLL rename:

```bash
npx prisma generate --no-engine
```

- If you used `--no-engine` and runtime fails with `InvalidDatasourceError` (`prisma://`), regenerate full client before running app:

```bash
npx prisma generate
```

- Swagger fails to initialize due to complex DTO circular references; set `ENABLE_SWAGGER=false` temporarily so API can still boot.



#frontend start
```
npx live-server public/frontend --host=0.0.0.0 --port=5500 --no-browser
```