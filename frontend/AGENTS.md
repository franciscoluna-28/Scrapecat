# Frontend Rules

Normative rules for the Next.js/TypeScript frontend. Architecture and rationale
live in `docs/`; project-wide rules are in the root `AGENTS.md`. Frontend debt is
tracked in [`docs/frontend-tech-debt.md`](../docs/frontend-tech-debt.md).

## Commands

- Dev server: `pnpm dev`
- Typecheck: `pnpm typecheck` (`next typegen && tsc --noEmit`)
- Lint: `pnpm lint`
- Tests: `pnpm test` (`vitest run`)
- Regenerate API types: `pnpm codegen` from the repo root (starts the backend)

## API boundary

- `src/shared/api/types.ts` is generated. Never edit it by hand.
- Every JSON request goes through `apiClient` + `unwrap` from
  `src/shared/api/client.ts`. Do not hand-roll `fetch` for REST.
- Raw `fetch` is allowed only for SSE streaming. It must use `authHeaders()` and
  throw `ApiError`/`ChatStreamError` — no ad-hoc error shapes.
- Errors surface as `error.message` (via `errorMessage()`), normally in a small
  toast. Never swallow a failure silently and never cast `error as Error`.
- Remove `res.error` branches; `unwrap` already normalizes transport, HTTP,
  non-JSON, and network failures.
- Every endpoint the frontend consumes must have a typed response schema in the
  backend. Add the TypeBox schema first, then run `pnpm codegen` — do not
  hand-write response shapes or cast `unknown` records.

## Data and state

- All React Query keys come from `src/shared/services/keys.ts`. No literal query
  keys.
- Server state lives in React Query. Zustand is only for persisted UI
  preferences.
- The URL is the source of truth for the active project and chat session.
- Do not duplicate mutations or selection logic across features. Add the flow
  once to the owning service/hook and reuse it.
- After a mutation, invalidate the narrowest key(s) that changed.

## Components

- Route files under `src/app` are Server Components by default. Add
  `"use client"` only to leaves that need state, effects, or browser APIs.
- Use the existing `src/components/ui` components. Radix is the default.
  `components/ui/combobox.tsx` is the only `@base-ui/react` consumer and is an
  accepted exception; do not add a third primitive stack.
- AI Elements under `src/components/ai-elements` are intentional vendored code.
  Do not trim or replace them. Do not vendor additional AI Elements or shadcn
  files unless the app actually uses them.
- Imports use the `@/src/...` alias.

## Testing

- Colocate tests as `*.test.ts` / `*.test.tsx` next to the code.
- Hooks, API services, and stream/transport code require tests. Pure helpers and
  presentational components alone are not enough.
- Test SSE with a mocked `fetch` returning a `ReadableStream`.
- Mock `apiClient` / service modules at the module boundary, not `fetch` inside
  every test.

## Consolidation

- If a feature adds a parallel version of an existing flow, either consolidate
  it in the same change or record it in `docs/frontend-tech-debt.md`.
- When touching a file with known debt that is directly in scope, pay it down —
  do not add a second pattern beside it.

## Done means

`pnpm typecheck`, `pnpm lint`, and `pnpm test` pass. Generated types are up to
date. New failures are handled and surfaced, not swallowed.
