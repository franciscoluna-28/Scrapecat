## 🐈 Fabric - GitHub Commits to Reports

Fabric is a high-performance data intelligence engine designed to transform raw GitHub repository activity into high-value executive reports. Engineered for Founding Engineers, small startups, and consultants who demand total visibility without the friction of manual tracking.

Built for lean teams tired of micromanagement and non-technical stakeholders who struggle to interpret Git activity. We translate code into clarity.

## Tech Stack
- Backend & Client: Next.js 16.
- Data Source: Native GitHub REST via `Octokit`.
- Intelligence: Groq API implementation utilizing Llama-3.1-8b-instant for low-latency, high-context report synthesis.

## Core Features
- **Deep Repository Sync:** Real-time extraction of commit metadata, going far beyond simple line counts to capture the intent of the work.
- **Executive Insights:** Automated synthesis of technical activity into business-centric summaries focused on feature delivery and velocity.
- **Guided Onboarding:** A streamlined, multi-step interface engineered to reduce cognitive load.
- **The Transparency Engine:** Generates high-fidelity Markdown reports that balance technical depth with executive readability.
- **Report Persistence:** A centralized dashboard to visualize, manage, and export historical reporting data.

## Future Roadmap
- **Multi-VCS Ecosystem:** Expanding support to GitLab, BitBucket, and self-hosted instances.
- Persona-Driven Synthesis:** Custom tone mapping to generate reports specifically tailored for CTOs, Founders, or Board Members.
- **Enterprise-Grade Security:** Implementing E2E Encryption, SSO, and Organization-level RBAC (Role-Based Access Control).


_The MVP focuses on core report generation and GitHub integration. Refinements and additional integrations will follow._


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

### 2. Groq Intelligence Layer

We utilize Groq’s LPU Inference Engine for low latency report generation. However, you can use any provider you wish. Feel free to skip this step if you're willing to configure a local LLM and change that in the code.

- 1. Access: Obtain your API key from the [Groq Console](https://console.groq.com/home)
- 2. Model: Fabric is pre-configured to use `Llama-3.1-8b-instant`, balancing high-context reasoning with near-instant execution.

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

Create a .env.local file in the root of your project and populate it with your credentials:

```Bash
# GitHub Infrastructure
GITHUB_TOKEN=your_personal_access_token

# LLM Intelligence
GROQ_API_KEY=your_groq_api_key

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Cloudflare R2 — host PR screenshots on your own infra
# so shared reports work for stakeholders without GitHub auth
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret
R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
R2_BUCKET_NAME=reports
R2_PUBLIC_URL=https://<your-custom-domain>.com/reports
```

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

### Environment

Create a `.env` file from the example:

```Bash
cp .env.example .env
```

Edit `.env` with your credentials:

```Bash
GITHUB_TOKEN=your_personal_access_token
GROQ_API_KEY=your_groq_api_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
DATABASE_URL=file:data/dev.db
R2_ACCESS_KEY_ID=your_r2_access_key
R2_SECRET_ACCESS_KEY=your_r2_secret
R2_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
R2_BUCKET_NAME=reports
R2_PUBLIC_URL=https://<your-custom-domain>.com/reports
```

The compose file reads `GITHUB_TOKEN` and `GROQ_API_KEY` from `.env` as build args so they're available during the Next.js build step. All vars (including R2) are also passed at runtime via `env_file`.

### Development (hot reload)

```Bash
docker compose up --build
```

Mounts source directly — changes reflected immediately via Next.js HMR at http://localhost:3000.

### Production

```Bash
docker compose --profile prod up --build
```

Multi-stage build with optimized image. SQLite data is persisted in a Docker volume.

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