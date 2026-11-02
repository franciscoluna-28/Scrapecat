# Frontend Tech Debt

Frontend-only debt. Backend debt is tracked in
[`architecture.md`](./architecture.md#tech-debt) and [`backlog.md`](./backlog.md).

Open items keep their original IDs. Each entry records the current state, the
evidence, and the intended direction so it can be picked up without re-deriving
the analysis. See [Suggested order](#suggested-order) for sequencing.

| ID | Area | Priority | Effort |
|---|---|---|---|
| FD-4 | Vendored AI Elements and dead UI | Medium | S |
| FD-5 | Tooling and config drift | Low | S |
| FD-6 | Server/client boundary underused | Low | M |
| FD-7 | Test coverage concentrated on low-risk helpers | Medium | M |

## Already paid

Resolved items live here so the original analysis does not have to be redone.
Their detail sections were removed from the open list.

### FD-1 — Chat streaming and state orchestration

Paid in `86ad5a3`, `f002ec6`, and `79fd84a`.

- `useAIChat` delegates message state to `chatMessagesReducer` in
  `live-messages.ts` (draft/token/done/error/progress), replacing the
  effect-driven session reset and ad-hoc streaming state.
- `chat-api.ts` owns the SSE transport: typed request body from `paths`,
  `authHeaders()`, `apiErrorFromResponse()`, `ChatStreamError`, and
  `consumeChatStream()`. Transport failures use the same toast path as
  in-stream errors instead of being swallowed.
- Cache invalidation is narrowed to `chat.messages(sessionId)` plus
  `chat.sessions(projectId)`.
- Scroll coupling is gone: the dashboard provides a `ScrollContainer` context
  and `useAIChat` scrolls that ref instead of `closest("[data-chat-scroll]")`.
- `MessageView` is memoized, so streaming tokens no longer re-render every row.
- Covered by `live-messages.test.ts`, `chat-api.test.ts` (mocked `fetch` with a
  `ReadableStream`), and `useAIChat.test.tsx`.

### FD-2 — API error and type boundary

Paid in `e94d7fd`, `45fb27e`, `87da0c3`, and `5875c52`.

- `shared/api/client.ts` defines `ApiError`, `toApiError`,
  `apiErrorFromResponse`, `errorMessage`, and `unwrap`; transport, HTTP,
  non-JSON, and network failures now normalize to one shape.
- Callers render `error.message`/`errorMessage(error)` instead of casting
  `unknown` or branching on `res.error`.
- Repository discovery responses are typed in the backend with TypeBox and
  regenerated into `types.ts`; `shared/types/index.ts` aliases generated
  `paths[...]` shapes instead of hand-writing fields.
- Cache keys run through `queryKeys` (no literal `["repositories"]`).
- Covered by `client.test.ts`.

### FD-3 — Project/session identity duplication

Paid in `523fa18`.

- `useActiveProject` is the single selector for the active project/session; the
  URL wins and `lastProjectId` is only a fallback for `/app`.
- Project creation goes through `useCreateProject`/`createProject` in
  `chat/services/projects-api.ts`, used by both the repository connect flow and
  demo mode.
- `resolveActiveProjectId` is exported and tested directly in
  `useChatProject.test.ts`.

FD-4 is partially paid: the 32 unused shadcn files and `ai-elements/task.tsx`
were deleted along with their unused dependencies. Its remaining scope is open
below.

## FD-4 — Vendored AI Elements and dead UI

**Priority:** medium. **Effort:** small.

- `frontend/src/components/ai-elements/prompt-input.tsx` is 1,464 lines of
  copied registry code; the chat only uses a small subset of its exports, and it
  carries its own `fetch` path for attachments (`:83`) that bypasses the API
  client.
- The 32 unused scaffolded shadcn files and `ai-elements/task.tsx` have been
  deleted. The 27 remaining `components/ui` files are all imported.
  `MessageResponse` stays because assistant messages render Markdown through
  Streamdown.
- Two primitive libraries are active: only `components/ui/combobox.tsx` uses
  `@base-ui/react`; the rest of the UI is Radix. This fragments API and
  accessibility behavior and ships two primitive stacks.

**Direction:** reduce `prompt-input` to the components actually used (or pin the
registry version and document the customization), and choose one primitive
library for new components. Keep the vendored-file policy in
`frontend/AGENTS.md` enforced so upgrades are deliberate.

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

Thirteen test files exist. FD-1 added coverage for chat streaming, transport,
and active-project resolution, so the remaining gap is provider and credential
code:

- `_features/git-providers/services/git-providers-api.ts`
- `_features/git-providers/hooks/useAddRepository.ts`
- `_features/settings/components/AISettingsManager.tsx`
- `_features/credentials/services/index.ts`

**Direction:** add provider/credential hook tests around the error contract from
FD-2, and keep the streaming tests (`chat-api.test.ts`, `useAIChat.test.tsx`,
`live-messages.test.ts`) green as the regression suite.

## WIP:

1. **FD-5** — fix `components.json` and remove stale root artifacts (unblocks
   future UI work).
2. **FD-7** — cover the remaining provider and credential modules.
3. **FD-4** — trim the vendored prompt input and settle on one primitive library.
4. **FD-6** — move client boundaries inward once the data layer is stable.
