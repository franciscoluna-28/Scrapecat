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
```

`frontend/.env`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_DEMO_MODE=true
NEXT_PUBLIC_ALLOW_ADD_REPOS=true
```

Deploying the backend on Vercel: see [`deploy-vercel.md`](./deploy-vercel.md).
