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
# Durable Postgres-backed jobs run in-process unless this is false.
WORKER_ENABLED=true
LOG_LEVEL=info
```

## Jobs and workspaces

Commit ingestion runs as durable, deduped jobs stored in Postgres (the `jobs`
table). The worker runs in-process with the API (`src/main.ts`) and claims due
jobs with `FOR UPDATE SKIP LOCKED`; there is no Redis or RabbitMQ. Set
`WORKER_ENABLED=false` on API-only replicas that share the database with a
worker.

Self-hosted ingestion clones the branch into `os.tmpdir()/scrapecat/<uuid>` with
`--filter=blob:none --no-checkout`, then deletes it when the job ends. A cheap
`git ls-remote` tip check against `project_branches` skips the clone when the
branch has not moved; crashed workspaces are swept on the next worker boot. The
serverless demo reads the GitHub REST API and does not clone anything.

### Lifecycle gap: project deletion

Deleting a `projects` row cascades in Postgres (`commit_chunks`, chat sessions,
`project_branches`). There is no persistent clone to clean up, only the missing
delete-project endpoint. Tracked as P2-3.

`frontend/.env`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_DEMO_MODE=true
NEXT_PUBLIC_ALLOW_ADD_REPOS=true
```

Deploying the backend on Vercel: see [`deploy-vercel.md`](./deploy-vercel.md).
