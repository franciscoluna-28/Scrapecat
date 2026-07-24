## 🐈 Fabric - GitHub Commits to Reports

Kill micromanagement. Fabric translates engineering work into reports normal people read without fancy meetings. Built because a CEO kept asking what engineering was doing **daily**. Everything was on Git. We open-sourced the fix as we believe code history is the only source of truth.

## Tech Stack
- **Backend:** Fastify 5 (Node.js), Drizzle ORM + libSQL, OpenRouter SDK
- **Frontend:** Next.js 16 (React 19), TanStack React Query, Tailwind CSS v4, shadcn/ui
- **Data Source:** Native GitHub REST via `Octokit`
- **Intelligence:** OpenRouter API utilizing Google Gemma 4 for free, low-latency report synthesis
- **Package Manager:** pnpm workspaces

## Core Features
- **Deep Repository Sync:** Real-time extraction of commit metadata, going far beyond simple line counts to capture the intent of the work.
- **Executive Insights:** Automated synthesis of technical activity into business-centric summaries focused on feature delivery and velocity.
- **Guided Onboarding:** A streamlined, multi-step interface engineered to reduce cognitive load.
- **The Transparency Engine:** Generates high-fidelity Markdown reports that balance technical depth with executive readability.
- **Report Persistence:** A centralized dashboard to visualize, manage, and export historical reporting data.

## Future Roadmap
- **RAG on Repositories (SurrealDB):** AI agents that understand your entire engineering history — ask questions about code, commits, PRs, and decisions. Powered by SurrealDB, replacing SQLite as we scale.
- **External Integrations:** Connect Slack, Linear, Jira, and Notion so reports cross-reference commits with tickets, messages, and docs.
- **Git Adapters:** Pluggable adapters for any git source — GitLab, BitBucket, self-hosted instances, and beyond.
- **Self-Hosted Storage:** MinIO support alongside Cloudflare R2, with more storage providers to come.
- **Persona-Driven Synthesis:** Custom tone mapping to generate reports specifically tailored for CTOs, Founders, or Board Members.
- **UI Renovation:** Full redesign focused on clarity, speed, and making reports the hero — less dashboard clutter, more insight density.
- **Enterprise-Grade Security:** Implementing E2E Encryption, SSO, and Organization-level RBAC (Role-Based Access Control).

AI is increasing commit velocity, not reducing it. Fabric is the missing layer that translates engineering output into something every department can actually understand. Kill micromanagement. Centralize the communication. Let code be the truth.


## Note for Early Adopters
Fabric is currently in active development. The primary goal of the MVP is to provide immediate value through GitHub insights. If you encounter any "rough edges", remember: we prioritize speed and transparency over perfection. 

**Ship fast, refactor as you scale.**

## Getting Started
To deploy the Fabric MVP, you need to configure the two primary data streams: the GitHub Control Plane and the Intelligence Layer.

### 1. GitHub API Configuration

Fabric requires a Personal Access Token (PAT) to securely fetch repository metadata and commit history.

- 1.  Navigate to [GitHub Settings](https://github.com/settings) > Developer Settings > Personal Access Tokens.
- 2.  For the MVP, ensure the repo (Full control of private repositories) and read:org scopes are enabled.
- 3. Fabric treats your data as read-only. We analyze the metadata to build reports without ever modifying your source code, following the principle of least privilege (POLP).

### 2. OpenRouter Intelligence Layer

We utilize OpenRouter's API to access free LLM models for report generation. No paid plan required — the free tier of `google/gemma-4-26b-a4b-it:free` works out of the box.

- 1. Sign up at [OpenRouter](https://openrouter.ai/keys) and create a free API key.
- 2. Model: Fabric uses `google/gemma-4-26b-a4b-it:free` by default — zero cost, no rate limiting for light usage.

### 3. Cloudflare R2 (Image Hosting)

Fabric extracts screenshots from PR descriptions and re-hosts them on Cloudflare R2 (S3-compatible). This is a **hard requirement** — without R2, images from PR bodies would link directly to `github.com/user-attachments/`, which:

- **Breaks for unauthenticated viewers** — GitHub blocks image loads for users not logged in, so stakeholders would see broken images.
- **Hits GitHub hotlinking limits** — shared reports would quickly exhaust GitHub's rate limits on image serving.
- **Leaks your origin** — stakeholders see `github.com` URLs, raising unnecessary questions about tooling.

By re-hosting on R2, images are publicly accessible via your own domain, work for anyone with the report link, and are fully under your control.

**Required R2 resources:**
- An R2 bucket (name configurable via `R2_BUCKET_NAME`)
- An S3-compatible API token (access key + secret)
- A custom domain or the public R2.dev URL for serving images

## Environment Setup

Copy the backend example and fill in your credentials:

```Bash
cp backend/.env.example backend/.env
```

Required values in `backend/.env`:

| Variable | Description |
|---|---|
| `OPENROUTER_API_KEY` | LLM access — get a free key at [openrouter.ai/keys](https://openrouter.ai/keys) |
| `GITHUB_TOKEN` | Repository data access — create one at [github.com/settings/tokens](https://github.com/settings/tokens) |

Optional R2 credentials are documented in the example for PR screenshot hosting.

## Local Deployment
Initialize the engine and start the development server:

```Bash
# Install dependencies
pnpm install

# Generate database migration. Fabric uses SQLite as default database.
pnpm run db:generate

# Push schema to database. Needed to store reports and repository data.
pnpm run db:push

# Start the development server
pnpm run dev
```

The application will be live at http://localhost:3000. Connect your first repository and start generating reports that make sense to humans.

## Docker Setup

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/)

### Development (hot reload)

```Bash
docker compose up --build
```

Two services start:
- **Backend** (Fastify) at http://localhost:4000 — auto-reloads via `tsx watch`
- **Frontend** (Next.js) at http://localhost:3000 — HMR via `next dev`

Source is mounted directly — changes are reflected immediately. Each service uses its own `Dockerfile.dev` for a leaner, focused build.

SurrealDB is also available on port **8000** for local development:

| Detail | Value |
|---|---|
| WebSocket URL (host) | `ws://localhost:8000/rpc` |
| WebSocket URL (Docker network) | `ws://surrealdb:8000/rpc` |
| User / Pass | `root` / `root` |
| Storage | `rocksdb` persisted via a named volume |

### Stop

```Bash
docker compose down
```

## Contributing
Fabric is currently in its founding stage. We welcome contributions from engineers who understand that documentation is as important as code.

- **Bug Reports:** Open an issue with a clear reproduction script and environment details.
- **Feature Requests:** Focused on scalability, reporting accuracy, and developer autonomy.
- **Architecture:** We prioritize modularity and low-latency execution.

## License
This project is licensed under the MIT License. It is designed to be open, transparent, and resilient—just like the reports it generates.

## Security & Support
If you discover a security vulnerability, please open a private issue or contact the maintainer directly. Fabric follows the Principle of Least Privilege (POLP): we fetch data to empower developers, not to expose them.

---

Fabric | Built for the builders.
_Engineered by Francisco Luna_