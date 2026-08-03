# Backend Testing Strategy

## Why we test this way

The backend has two architectural characteristics that drive the entire testing approach:

1. **Fastify factory pattern.** `buildApp()` in `src/app.ts` returns a configured instance without starting a server. This lets us use `app.inject()` — zero-network HTTP injection via `light-my-request` — instead of binding to a port. Every test follows this three-step pattern:

```ts
const app = await buildApp();
const res = await app.inject({ method, url, ... });
await app.close();
```

2. **No dependency injection.** Route handlers import services directly (`import { db } from "../db/client"`). To isolate tests from external services (GitHub API, OpenRouter, Postgres), we use vitest's `vi.mock()` at the top of each test file, which is hoisted above imports and replaces modules before the app loads.

## What to mock

| Module | Why |
|---|---|
| `src/shared/integrations/git-provider/` | All routes hit GitHub API via Octokit |
| `src/reports/ai.ts` | Report generation calls OpenRouter |
| `src/db/client.ts` | Postgres via postgres-js (lazy — importing it does not connect, so unit tests need no live DB) |
| `src/config/env.ts` | Control GITHUB_TOKEN and other config |
| `global.fetch` | `GET /api/v1/models` calls OpenRouter directly |
| `src/reports/prompts.ts` | **Do not mock** — pure string functions, fast and deterministic |
| `src/shared/utils.ts` | **Do not mock** — pure regex functions, fast and deterministic |

## How to write a test

```ts
// 1. Mock external modules at the top — vitest hoists this before imports
vi.mock("../shared/integrations/git-provider", () => ({
  getGitProvider: vi.fn(() => mockProvider),
}));

// 2. Imports come after vi.mock
import { buildApp } from "../app";

// 3. Standard describe/it with buildApp + inject + close
describe("GET /api/v1/branches", () => {
  let app;

  beforeAll(async () => { app = await buildApp(); });
  afterAll(async () => { await app.close(); });

  it("returns branches", async () => {
    mockProvider.listBranches.mockResolvedValue(["main", "dev"]);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner/repo/branches",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ branches: ["main", "dev"] });
  });

  it("returns 500 when GitHub fails", async () => {
    mockProvider.listBranches.mockRejectedValue(new Error("API error"));
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner/repo/branches",
    });
    expect(res.statusCode).toBe(500);
  });
});
```

### Testing different env values

When a test needs a different `process.env` / `env` value, create a **separate test file** with a distinct `vi.mock("../config/env")`. Vitest tears down modules between files but caches them within a file, so two describe blocks in the same file cannot remock the same module differently.

See `src/verification/routes.test.ts` (GITHUB_TOKEN set) and `src/verification/routes.no-token.test.ts` (GITHUB_TOKEN empty) as the canonical example.

## Integration tests (Postgres)

`src/db/integration.test.ts` exercises the store layer and the DB-backed routes (`GET /api/v1/projects`, `GET /api/v1/reports/:id/commits`, `GET /api/v1/reports`) against a **live Postgres**. It is skipped by default and runs only under the integration config:

```bash
pnpm test:integration   # requires a running Postgres (e.g. docker compose up -d db)
```

It targets `DATABASE_URL` (defaulting to `postgres://scrapecat:scrapecat@localhost:5432/scrapecat`, overridable via the shell). Test rows use a fixed `github_project_id` marker and a marked credential name, and both `afterAll` and the final cascade test remove them, so real dev data is untouched.

## Conventions

- Test files are **colocated** with their domain source: `src/health/routes.test.ts` tests `src/health/routes.ts`
- Suffix: `*.test.ts`
- Reuse a single `buildApp()` instance per describe block when routes are stateless
- Always call `app.close()` in `afterAll` / `afterEach`
- Use `Type.Any()` casts on mock return values (e.g., `const commits: any = [...]`) to bypass Octokit's granular response types

## Running

```bash
pnpm test              # single run (unit + route tests, no DB needed)
pnpm test:watch        # watch mode
pnpm test:integration  # store/route tests against a live Postgres
```
