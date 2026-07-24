# Backend Testing Strategy

## Framework

- **Vitest** — fast, ESM-native, compatible with TypeScript
- **Fastify's `app.inject()`** — zero-network HTTP injection via `light-my-request`
- **`vi.mock()`** — vitest's module mocking for external dependencies

## Architecture

The backend uses a **factory pattern** — `buildApp()` in `src/app.ts` creates and returns a configured Fastify instance, without starting a server. This is the recommended approach from the [Fastify Testing Guide](https://fastify.dev/docs/v5.3.x/Guides/Testing/).

Every test follows the same 3-step pattern:

```ts
const app = await buildApp();            // 1. create instance
const res = await app.inject({ ... });   // 2. send fake request
await app.close();                       // 3. clean up
```

## Mocking Strategy

The app has **no dependency injection** — modules are imported directly. All mocks use vitest's `vi.mock()` hoisted at the top of each test file.

| Module | Strategy |
|---|---|
| `src/shared/github.ts` | Mock all exported functions (`getAllRepositories`, `getRepositoryBranches`, `getRepositoryCommits`, `getRepositoryCommitCount`, `octokit`) |
| `src/shared/ai.ts` | Mock `callAI` to return canned responses |
| `src/shared/r2.ts` | Mock `uploadImagesToR2` to return `[]` |
| `src/db/client.ts` | Mock `db` object with `vi.fn()` for all query/insert/update methods |
| `src/config/env.ts` | Mock to control env vars (e.g. `GITHUB_TOKEN`) |
| `global.fetch` | Mock via `vi.stubGlobal()` for routes that call external HTTP |
| `src/shared/prompts.ts` | **Real implementation** — pure functions, no I/O |
| `src/shared/utils.ts` | **Real implementation** — pure functions, no I/O |

## Test File Conventions

- Tests are **colocated** with source files: `src/routes/health.test.ts` tests `src/routes/health.ts`
- Naming: `*.test.ts`
- Each `describe` block creates a fresh `buildApp()` instance (or reuses one if routes are stateless)
- `app.close()` in `afterEach` / `afterAll` to release resources

## Writing a Test

### Route with no external dependencies

```ts
import { describe, it, expect } from "vitest";
import { buildApp } from "../app";

describe("GET /api/v1/health", () => {
  it("returns status ok", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
    await app.close();
  });
});
```

### Route with mocked dependencies

```ts
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

vi.mock("../shared/github", () => ({
  getAllRepositories: vi.fn(),
}));

import { buildApp } from "../app";
import { getAllRepositories } from "../shared/github";

describe("GET /api/v1/repositories", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => { app = await buildApp(); });
  afterAll(async () => { await app.close(); });

  it("returns repositories", async () => {
    vi.mocked(getAllRepositories).mockResolvedValue([{ name: "repo1" }]);
    const res = await app.inject({ method: "GET", url: "/api/v1/repositories" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([{ name: "repo1" }]);
  });
});
```

## Running Tests

```bash
pnpm test          # single run
pnpm test:watch    # watch mode
```
