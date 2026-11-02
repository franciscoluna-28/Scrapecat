# Frontend Tech Debt

Frontend-only debt. Backend debt is tracked in
[`architecture.md`](./architecture.md#tech-debt) and [`backlog.md`](./backlog.md).

Items are ordered by leverage, not effort. Each entry records the current state,
the evidence, and the intended direction so it can be picked up without
re-deriving the analysis.

| ID | Area | Priority | Effort |
|---|---|---|---|
| FD-1 | Chat streaming and state orchestration | High | M |
| FD-2 | API error and type boundary | High | M |
| FD-3 | Project/session identity duplication | Medium | S–M |
| FD-4 | Vendored AI Elements and dead UI | Medium | S |
| FD-5 | Tooling and config drift | Low | S |
| FD-6 | Server/client boundary underused | Low | M |
| FD-7 | Test coverage concentrated on low-risk helpers | Medium | M |

## FD-1 — Chat streaming and state orchestration

**Priority:** high. **Effort:** medium.

`useAIChat` is the highest-risk file in the frontend: it owns session creation,
URL rewriting, optimistic messages, SSE state, scroll restoration, and cache
invalidation in one 159-line hook.

- Transport is hand-rolled in `frontend/src/_features/chat/services/chat-api.ts:104-152`:
  raw `fetch`, a duplicated `x-anonymous-id` header (`:117`), seven positional
  arguments (`sessionId`, `content`, `branch`, `onChunk`, `model`, `provider`,
  `persona`), and no use of the typed `openapi-fetch` client.
- Transport failures are invisible. `frontend/src/_features/chat/hooks/useAIChat.ts:156`
  has a bare `catch {}` that drops the draft without a toast. Only in-stream
  `error` frames are surfaced (`:147`).
- Three overlapping sources of truth for the active conversation: URL search
  params, the `lastProjectId` store, and the React Query cache.
- Cache invalidation fires three overlapping keys back to back
  (`useAIChat.ts:153-155`: `chat.messages`, `chat.sessions`, `chat.all`).
- Scroll restoration reaches into the layout with
  `bottomRef.current?.closest("[data-chat-scroll]")` (`useAIChat.ts:65,72`),
  coupling the hook to a DOM contract owned by
  `frontend/src/app/app/(dashboard)/layout.tsx`.
- Session reset is a `setState`-in-effect suppressed with an eslint-disable
  (`useAIChat.ts:52-53`).
- Every token re-renders every `MessageView` because `ChatMessages.tsx:75`
  maps without a memo boundary; `components/ai-elements/message.tsx:20` imports
  `memo` but never uses it.

**Direction:** keep the `local-*` streaming helpers, but extract a reducer for
message state and a single transport helper that owns auth headers and error
normalization. Collapse the invalidations to the narrowest key. Surface
transport errors through the same toast path as stream errors. Replace the DOM
`closest()` lookup with an explicit scroll container reference. Add memoization
at the message boundary before virtualizing anything.

## FD-2 — API error and type boundary

**Priority:** high. **Effort:** medium.

The generated `frontend/src/shared/api/types.ts` is the source of truth, but the
runtime boundary does not preserve it.

- `unwrap()` throws a raw `unknown` and casts the response (`shared/api/client.ts:25-26`),
  so callers re-cast to read error text
  (`_features/git-providers/components/GitProviderConnectForm.tsx:150,191`).
- Hand-written API types and casts remain around generated types:
  `_features/git-providers/services/git-providers-api.ts:141` casts the
  repository response to `GitProviderRepositoryItem[]`, and
  `shared/types/index.ts` hand-rolls repository fields that the spec already
  describes.
- Error handling is inconsistent: `unwrap`, direct `res.error` branches, generic
  toasts, and silent returns all coexist
  (`useDemoProjects.ts:64`, `useAddRepository.ts:97`, `useAIChat.ts:156`).
- A literal query key is used instead of the registry
  (`git-providers-api.ts:101,120`: `["repositories"]`).

**Direction:** normalize every failure into a typed `ApiError` (status, message,
request id) at `unwrap`, then let hooks and components render `error.message`
without casts. Replace hand-written response shapes with generated
`paths[...]` aliases and delete the casts. Route all cache keys through
`shared/services/keys.ts`.

## FD-3 — Project/session identity duplication

**Priority:** medium. **Effort:** small–medium.

Active-project resolution and project creation are implemented more than once,
so behavior can drift between the sidebar, the chat view, and the add-repo flow.

- `resolveActiveProjectId` is called independently from both
  `_features/chat/hooks/useChatProject.ts:53` and
  `_features/chat/components/ChatSidebarContent.tsx:33`.
- Project creation (`POST /api/v1/projects`) is duplicated in
  `_features/git-providers/hooks/useAddRepository.ts:88` and
  `_features/demo/hooks/useDemoProjects.ts:55`, including cache invalidation.
- `useProjects()` is instantiated in five places
  (`useAddRepository`, `useDemoProjects`, `useSidebarProjects`, `useChatProject`,
  and `projects-api` itself). React Query dedupes the fetch, but the derived
  selection logic is repeated.

**Direction:** make the URL the single source of truth for the active
project/session, expose one selector hook, and move project creation into a
single mutation in `_features/chat/services/projects-api.ts` used by both the
connect dialog and demo mode.

## FD-4 — Vendored AI Elements and dead UI

**Priority:** medium. **Effort:** small.

- `frontend/src/components/ai-elements/prompt-input.tsx` is 1,286 lines of
  copied registry code; the chat only uses a small subset of its exports, and it
  carries its own `fetch` path for attachments (`:83`) that bypasses the API
  client.
- 32 of 56 files under `components/ui/` are not imported anywhere outside that
  directory. They are scaffolded shadcn components, not app code.
- `ai-elements/task.tsx`, `MessageResponse.tsx`, and `MessageResponseInner.tsx`
  are unused.
- Two primitive libraries are active: only `components/ui/combobox.tsx` uses
  `@base-ui/react`; the rest of the UI is Radix. This fragments API and
  accessibility behavior and ships two primitive stacks.

**Direction:** reduce `prompt-input` to the components actually used (or pin the
registry version and document the customization), delete unused UI and AI
Elements files, and choose one primitive library for new components. Record the
vendored-file policy so upgrades are deliberate.

## FD-5 — Tooling and config drift

**Priority:** low. **Effort:** small.

- `frontend/components.json:8,16-20` points at `app/globals.css`,
  `@/components`, `@/lib`, and `@/hooks`. The app actually lives under `src/`,
  and `frontend/tsconfig.json` maps `@/*` to `./*`, which is why imports are
  written as `@/src/...`. The next `shadcn add` will write to a non-existent
  location instead of `src/components`.
- The repo root still contains empty `src/` and `components/` directories, a
  stale root `.next/`, and a root `next-env.d.ts`; the real app is under
  `frontend/`.
- `tsconfig.json` keeps `allowJs: true` although the codebase is TypeScript-only.

**Direction:** align `components.json` aliases and CSS path with `src/`, then
decide whether `@/*` should map to `./src/*` and normalize imports in one
mechanical pass. Remove the root-level Next.js leftovers.

## FD-6 — Server/client boundary underused

**Priority:** low. **Effort:** medium.

Only `src/app/layout.tsx` and `src/app/page.tsx` are Server Components. Every
route page and the dashboard layout are client components
(`src/app/app/(dashboard)/layout.tsx`, `page.tsx`, `settings/page.tsx`,
`api-keys/page.tsx`). The `Suspense` boundary in the dashboard layout has a
`null` fallback, so the shell disappears on first load.

**Direction:** keep the interactive chat/sidebar client, but make route layouts
and static shells Server Components and push `"use client"` down to the leaves
that need state, effects, or browser APIs. Give the `Suspense` boundary a real
skeleton.

## FD-7 — Test coverage concentrated on low-risk helpers

**Priority:** medium. **Effort:** medium.

Ten test files exist, and they cover pure helpers, URL parsing, and a few
presentational components. The riskiest modules have no tests:

- `_features/chat/hooks/useAIChat.ts`
- `_features/chat/services/chat-api.ts` (SSE parsing, streaming, error frames)
- `_features/git-providers/services/git-providers-api.ts`
- `_features/git-providers/hooks/useAddRepository.ts`
- `_features/settings/components/AISettingsManager.tsx`
- `_features/credentials/services/index.ts`

**Direction:** before refactoring FD-1, add reducer and transport tests (mock
`fetch` with a `ReadableStream`) plus hook tests for session creation, error
handling, and cache invalidation. Then add provider/credential hook tests around
the error contract from FD-2.

## Suggested order

1. **FD-5** — fix `components.json` and remove stale root artifacts (unblocks
   future UI work).
2. **FD-2** — typed `ApiError` and generated response types (the contract every
   hook needs).
3. **FD-7 + FD-1** — test the reducer/transport, then refactor chat streaming
   onto them.
4. **FD-3** — collapse project identity and creation into one path.
5. **FD-4** — delete dead UI and trim the vendored prompt input.
6. **FD-6** — move client boundaries inward once the data layer is stable.
