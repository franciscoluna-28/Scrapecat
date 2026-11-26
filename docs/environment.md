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
# GitLab (self-hosted path; demo mode stays GitHub-only). `read_api` +
# `read_repository` scopes. Seeds the connection when no token is stored via UI.
GITLAB_TOKEN=
# GitLab instance origin; default is https://gitlab.com. One host per backend.
GITLAB_HOST=https://gitlab.com
AI_MODEL=mimo-v2.6-flash
AI_TIMEOUT_MS=120000
# Local Ollama (optional; no cloud key required).
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_API_KEY=ollama
PORT=4000
HOST=0.0.0.0
DATABASE_POOL_MAX=10
DATABASE_PREPARE=true
EMBEDDING_MODEL=openai/text-embedding-3-small
EMBEDDING_ENABLED=true
DEMO_RESTRICT_KEYS=true
RATE_LIMIT_MAX=240
CHAT_RATE_LIMIT_MAX=20
REPORT_RATE_LIMIT_MAX=5
REPO_ARCHIVE_DIR=repos
# Durable Postgres-backed jobs run in-process unless this is false.
WORKER_ENABLED=true
LOG_LEVEL=info
```

## Jobs and archives

Commit ingestion runs as durable, deduped jobs stored in Postgres (the `jobs`
table). The worker runs in-process with the API (`src/main.ts`) and claims due
jobs with `FOR UPDATE SKIP LOCKED`; there is no Redis or RabbitMQ. Set
`WORKER_ENABLED=false` on API-only replicas that share the database with a
worker.

`REPO_ARCHIVE_DIR` (default `repos/`) holds the local clone used by self-hosted
ingestion. The serverless demo reads the GitHub REST API and does not use an
archive.

### Lifecycle gap: project deletion

Deleting a `projects` row cascades in Postgres (`commit_chunks`, chat sessions),
but it does **not** delete the `fs` clone under `REPO_ARCHIVE_DIR`. There is no
delete-project endpoint today, so archives can only be reclaimed manually when
it matters. Tracked as P2-3.

`frontend/.env`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_DEMO_MODE=true
NEXT_PUBLIC_ALLOW_ADD_REPOS=true
```

Deploying the backend on Vercel: see [`deploy-vercel.md`](./deploy-vercel.md).
