# Environment Variables — Demo Mode

`backend/.env`:

```bash
DATABASE_URL=postgres://user:password@host:5432/db
ENCRYPTION_KEY=
OPENROUTER_API_KEY=
DEMO_MODE=true
ALLOW_ADD_REPOS=true
CORS_ORIGIN=http://localhost:3000

# optional
GITHUB_TOKEN=
AI_MODEL=mimo-v2.6-flash
PORT=4000
HOST=0.0.0.0
DATABASE_POOL_MAX=10
DATABASE_PREPARE=true
EMBEDDING_MODEL=openai/text-embedding-3-small
EMBEDDING_ENABLED=true
DEMO_RESTRICT_KEYS=true
RATE_LIMIT_MAX=240
CHAT_RATE_LIMIT_MAX=20
REPO_ARCHIVE_DIR=repos
LOG_LEVEL=info

# Archive warm cache + job queue (optional; defaults are infra-free)
ARCHIVE_STORE=fs          # fs (default) | s3 | memory (tests)
QUEUE_DRIVER=memory       # memory (default, inline) | bullmq
WORKER_ENABLED=true       # set false for API-only replicas
REDIS_URL=redis://localhost:6379
S3_BUCKET=scrapecat-archives
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
S3_PREFIX=archives
```

## Archive store & job queue

Both default to zero-infra: `ARCHIVE_STORE=fs` keeps today's local clone under
`REPO_ARCHIVE_DIR`, and `QUEUE_DRIVER=memory` runs ingestion inline (this is what
the serverless demo uses).

`docker-compose.yml` also ships **Redis** (BullMQ) and **MinIO** (S3 archive
cache) for local full-stack runs. MinIO is initialized automatically by the
`minio-init` service, which waits for the server and creates the
`scrapecat-archives` bucket with `mc mb --ignore-existing`. To use them:

```bash
# start the stack with the queue + S3 cache enabled
ARCHIVE_STORE=s3 QUEUE_DRIVER=bullmq docker compose up
```

- MinIO API: http://localhost:9000 · Console: http://localhost:9001 (`minioadmin` / `minioadmin`)
- Archives are stored one `tar.gz` object per branch (`archives/{owner}/{repo}/{branch}.tar.gz`), overwritten only when the branch tip advances.
- In production, point `S3_*` at real S3 (or any S3-compatible store) instead of MinIO; `S3_FORCE_PATH_STYLE` can stay `false` there.

### Lifecycle gap: project deletion

Deleting a `projects` row cascades in Postgres (`commit_chunks`, chat sessions), but it does **not** delete the archive — neither the S3 object nor the `fs` clone under `REPO_ARCHIVE_DIR`. There is no delete-project endpoint today, and archives are regenerable cache, so orphaning them is an accepted trade-off rather than a correctness issue. Reclaim space manually (delete objects / add an S3 lifecycle rule) when it matters.

`frontend/.env`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_DEMO_MODE=true
NEXT_PUBLIC_ALLOW_ADD_REPOS=true
```

Deploying the backend on Vercel: see [`deploy-vercel.md`](./deploy-vercel.md).
