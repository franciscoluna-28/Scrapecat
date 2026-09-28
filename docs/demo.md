# Demo Mode

Scrapecat's **demo mode** is the serverless-first profile used for the **public,
hosted concept demo** — a free-to-run deployment that we share with investors to
validate the idea. It is the same application and the same PostgreSQL database as
the self-hosted product; demo mode only changes *how commits are read* and *what
visitors are allowed to do*.

> The public demo is intended to run serverless. The concept build targets a
> always-on serverless host (Cloudflare Workers for the public edge, or any
> Node-compatible serverless host) backed by managed PostgreSQL. See
> [Runtime notes](#runtime-notes) for the exact requirements.

## Why demo mode exists

Self-hosted Scrapecat ingests commits by cloning a repo with the native `git`
binary into a local archive. That needs a git binary and persistent disk, which
serverless hosts don't provide. Demo mode removes both requirements:

- **No git binary, no disk.** Commits are read from the public GitHub REST API
  via Octokit and written straight into Postgres.
- **No secrets required.** The demo reads public repos anonymously
  (60 requests/hour per IP). A token is optional and only raises the limit.
- **Database-first.** GitHub is only consulted to fill gaps. Once a branch is
  ingested, every read is served from Postgres (see
  [Cross-user behavior](#cross-user-behavior)).

## What demo mode changes

| Area | Self-hosted | Demo mode (`DEMO_MODE=true`) |
|---|---|---|
| Ingestion | `git clone` + `git log`/`diff-tree` | GitHub REST API (Octokit) |
| Runtime needs | git binary + disk | HTTPS + PostgreSQL only |
| GitHub token | Typically required | Optional (anonymous public access) |
| Repo scope | Any repo you can access | **Public repos only** |
| Branches | All branches | **`main` / `master`** (or the repo default) |
| BYOK | Visitors can add keys | Disabled (`DEMO_RESTRICT_KEYS`) |
| Identity | `/user` used for status | Never called — owner identity not exposed |
| Repo adding | Always allowed | Configurable via `ALLOW_ADD_REPOS` |

## Configuration

Backend (`backend/.env`):

```bash
DEMO_MODE=true              # API ingestion + public-only hardening
# ALLOW_ADD_REPOS=true       # default true — set false to lock the repo set
# GITHUB_TOKEN=...           # optional; fine-grained PAT, public read-only
DATABASE_URL=postgres://...  # required
ENCRYPTION_KEY=...           # required
OPENROUTER_API_KEY=...       # required (LLM + embeddings)
```

Frontend (`frontend/.env`):

```bash
NEXT_PUBLIC_DEMO_MODE=true
# NEXT_PUBLIC_ALLOW_ADD_REPOS=false   # match the backend when locking
```

`DEMO_MODE=true` implies `DEMO_RESTRICT_KEYS=true`. `ALLOW_ADD_REPOS` is
independent, so you can seed first and lock later.

## Seeding workflow (one-time)

Repos are ingested lazily — connecting a repo only creates a project row;
ingestion happens when a branch is prepared (selecting a branch, or sending the
first chat message on that project).

1. Start with `DEMO_MODE=true` and `ALLOW_ADD_REPOS=true` (default).
2. Connect the public repos you want to ship.
3. Select the branch once per repo (only `main`/`master` are offered). This
   ingests commits + embeddings into Postgres.
4. Set `ALLOW_ADD_REPOS=false` and `NEXT_PUBLIC_ALLOW_ADD_REPOS=false`, redeploy.

Visitors then see only the ingested repos/branches, served from the database.

## Cross-user behavior

Ingestion is **not** per-user and does not run on a timer. `prepareProjectBranch`
counts the commits already stored for `(project, branch)`:

- **Visitor A** opens a repo and selects `main` → commits are ingested into
  Postgres and embedded.
- **Visitor B** opens the same project two hours later → the branch already has
  rows, so `prepareProjectBranch` returns immediately **without any GitHub call**
  and retrieval runs entirely against the database.

The same is true of a returning visitor A. There is no staleness re-crawl in demo
mode — the ingested set is stable, which is exactly what keeps the demo within
anonymous rate limits. If an ingest *does* fail (rate limit, network), the request
falls back to whatever rows already exist instead of erroring.

`chat_sessions` are scoped per visitor (via the `x-anonymous-id` header), while
projects/commits are shared — so visitors get their own chat history over the
same shared, pre-ingested data.

## Privacy & token guidance

Demo mode never calls user-scoped GitHub endpoints (`/user`, `/user/repos`), so
the token owner's identity and private repos are not exposed to visitors. If you
do provide a token for a higher rate limit, use a **fine-grained PAT** with:

- Repository access → **Public repositories (read-only)**
- Permissions → **none**

GitHub enforces this at the token level: it cannot read your private repos even if
the application had a bug.

## Runtime notes

- **Frontend (Next.js)** runs on any serverless/edge host (Cloudflare Pages or
  Workers via OpenNext, Vercel, etc.).
- **Backend (Fastify + `postgres`/`postgres-js`)** is a Node server. On
  Cloudflare Workers it requires `nodejs_compat` and a Workers-compatible
  PostgreSQL path (e.g. **Hyperdrive**); otherwise run it on any Node-compatible
  serverless host (Vercel, Fly.io, Deno Deploy via a Node adapter) or a small
  container.
- **PostgreSQL with pgvector** is required in all cases (Neon, Supabase, or any
  managed Postgres with the `vector` extension).
- Serverless hosts are stateless: demo mode keeps no local archive, so nothing is
  lost between invocations. All state lives in Postgres.

## Cost

The demo is designed to run on free tiers:

- **GitHub**: anonymous public access — $0 (optional fine-grained PAT for a
  higher limit).
- **PostgreSQL**: free tiers (Neon/Supabase).
- **LLM + embeddings**: an OpenRouter free/cheap model.

## Not the self-hosted product

Demo restrictions are opt-in via environment variables. With `DEMO_MODE` unset,
Scrapecat behaves as the full self-hosted product: archive-based ingestion, all
branches, private repos, and BYOK. See `README.md`.
