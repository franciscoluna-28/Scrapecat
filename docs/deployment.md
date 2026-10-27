# Docker Deployment

Production images are workspace-aware and self-contained. They are separate
from the serverless profile: Vercel deployments continue to use
[`deploy-vercel.md`](./deploy-vercel.md) and are not affected by these images.

## Images

| Image | Dockerfile | Runtime |
|---|---|---|
| Backend | `backend/Dockerfile` | Node 22 + native `git`, compiled `dist/main.mjs` |
| Frontend | `frontend/Dockerfile` | Node 22 + Next standalone server, build-time public env |

The backend image runs migrations on boot (`RUN_MIGRATIONS=false` to skip), runs
as the non-root `node` user, and exposes `GET /api/v1/health/ready` as its
healthcheck. The frontend image runs the non-root `nextjs` user against Next's
standalone server. Standalone output is enabled only when
`NEXT_OUTPUT=standalone`, which the Dockerfile sets; Vercel/serverless builds do
not set it and are unchanged.

Build them from the repository root:

```bash
docker build -f backend/Dockerfile -t scrapecat-backend .
docker build -f frontend/Dockerfile -t scrapecat-frontend .
```

The frontend bakes `NEXT_PUBLIC_*` values into the browser bundle at build time:

```bash
docker build -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.com \
  --build-arg NEXT_PUBLIC_DEMO_MODE=false \
  -t scrapecat-frontend .
```

## Compose

`docker-compose.prod.yml` runs Postgres, the backend, and the frontend with
health-gated startup:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Configuration:

- Put backend secrets in `backend/.env` (`ENCRYPTION_KEY`, provider keys,
  `GITHUB_TOKEN`, etc.). It is optional; values in the compose `environment`
  block win.
- `CORS_ORIGIN` must be the public frontend origin.
- `NEXT_PUBLIC_API_URL` is the backend URL **as seen by the browser**.
- Postgres data lives in the `postgres_data` volume; cloned archives live in
  `repo_archives` (or use `ARCHIVE_STORE=s3` and set the `S3_*` variables).

## Migrations

The backend entrypoint applies migrations before starting the server. For a
single instance this is the simplest path. With multiple replicas, run
migrations once out-of-band and start the replicas with
`RUN_MIGRATIONS=false`:

```bash
docker run --rm --env-file backend/.env scrapecat-backend node dist/migrate.mjs
```

## Health and shutdown

- Liveness: `GET /api/v1/health`
- Readiness: `GET /api/v1/health/ready` (checks Postgres)
- `SIGTERM` drains active ingest jobs (bounded) before exit; the compose file
  allows 20 seconds for that.

Put a TLS-terminating reverse proxy (Caddy, nginx, a load balancer) in front of
the frontend and backend in production.
