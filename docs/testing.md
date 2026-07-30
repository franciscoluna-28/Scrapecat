# Backend Testing Strategy

## Why we test this way

The backend has two architectural characteristics that drive the entire testing approach:

1. **Fastify factory pattern.** `buildApp()` in `src/app.ts` returns a configured instance without starting a server. This lets us use `app.inject()` — zero-network HTTP injection via `light-my-request` — instead of binding to a port. Every test follows this three-step pattern:

```ts
const app = await buildApp();
const res = await app.inject({ method, url, ... });
await app.close();
```

2. **No dependency injection.** Route handlers import services directly (`import { db } from "../db/client"`). To isolate tests from external services (GitHub API, OpenRouter, SQLite, R2), we use vitest's `vi.mock()` at the top of each test file, which is hoisted above imports and replaces modules before the app loads.

## What to mock

| Module | Why |
|---|---|
| `src/shared/github.ts` | All routes hit GitHub API via Octokit |
| `src/shared/ai.ts` | Report generation calls OpenRouter |
| `src/shared/r2.ts` | Image uploads to Cloudflare R2 |
| `src/db/client.ts` | SQLite via libSQL client |
| `src/config/env.ts` | Control GITHUB_TOKEN and other config |
| `global.fetch` | `GET /api/v1/models` calls OpenRouter directly |
| `src/shared/prompts.ts` | **Do not mock** — pure string functions, fast and deterministic |
| `src/shared/utils.ts` | **Do not mock** — pure regex functions, fast and deterministic |

## How to write a test

```ts
// 1. Mock external modules at the top — vitest hoists this before imports
vi.mock("../shared/github", () => ({
  getRepositoryBranches: vi.fn(),
}));

// 2. Imports come after vi.mock
import { buildApp } from "../app";
import { getRepositoryBranches } from "../shared/github";

// 3. Standard describe/it with buildApp + inject + close
describe("GET /api/v1/branches", () => {
  let app;

  beforeAll(async () => { app = await buildApp(); });
  afterAll(async () => { await app.close(); });

  it("returns branches", async () => {
    vi.mocked(getRepositoryBranches).mockResolvedValue(["main", "dev"]);
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/repositories/owner/repo/branches",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ branches: ["main", "dev"] });
  });

  it("returns 500 when GitHub fails", async () => {
    vi.mocked(getRepositoryBranches).mockRejectedValue(new Error("API error"));
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

See `verification.test.ts` (GITHUB_TOKEN set) and `verification.no-token.test.ts` (GITHUB_TOKEN empty) as the canonical example.

## Conventions

- Test files are **colocated** with source: `src/routes/health.test.ts` tests `src/routes/health.ts`
- Suffix: `*.test.ts`
- Reuse a single `buildApp()` instance per describe block when routes are stateless
- Always call `app.close()` in `afterAll` / `afterEach`
- Use `Type.Any()` casts on mock return values (e.g., `const commits: any = [...]`) to bypass Octokit's granular response types

## Running

```bash
pnpm test          # single run
pnpm test:watch    # watch mode
```
