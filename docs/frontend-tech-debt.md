# Frontend Tech Debt

Frontend-only debt. Backend debt is tracked in
[`architecture.md`](./architecture.md#tech-debt) and [`backlog.md`](./backlog.md).

Open items keep their original IDs. Each entry records the current state, the
evidence, and the intended direction so it can be picked up without re-deriving
the analysis. See [Suggested order](#suggested-order) for sequencing.

| ID | Area | Priority | Effort |
|---|---|---|---|
| FD-4 | Vendored AI Elements and dead UI | Accepted | — |

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

### FD-5 — Tooling and config drift

Paid in the current frontend pass.

- `components.json` now points at `src/app/globals.css` and the `@/src/...`
  aliases the app actually uses, so the next `shadcn add` writes to the right
  place.
- `allowJs` is off.
- The stale root `.next/` directory was removed; the root has no `src/`,
  `components/`, or `next-env.d.ts` leftovers.
- `@/*` still maps to `./*`; imports stay `@/src/...` to avoid a repo-wide
  mechanical rewrite.

### FD-6 — Server/client boundary underused

Paid in the current frontend pass.

- `src/app/app/(dashboard)/layout.tsx` is a Server Component. The client shell
  (`SidebarProvider`, `TooltipProvider`, `ScrollContainerProvider`, sidebar
  content) moved to `components/global/DashboardShell`.
- The dashboard `Suspense` boundary now renders a real sidebar/inset skeleton
  instead of `fallback={null}`.
- The dashboard, settings, and API-keys route pages no longer carry
  `"use client"`; only the interactive components they compose do.

### FD-7 — Test coverage concentrated on low-risk helpers

Paid in the current frontend pass.

- Added `git-providers-api.test.tsx`, `useAddRepository.test.ts`,
  `AISettingsManager.test.tsx`, and `credentials/services/index.test.tsx`.
- Coverage now includes connection reads/mutations, repository discovery,
  branch reads, add-repository selection/creation/validation, settings
  load/save/error paths, and credential list/add/verify.
- The existing chat streaming tests remain the regression suite.

FD-4 is accepted debt: AI Elements are intentionally retained, and the two
primitive stacks are documented rather than migrated.


## FD-4 — Vendored AI Elements and dead UI

**Status:** accepted. No code changes planned.

- AI Elements are intentionally kept as vendored registry code. In particular,
  `components/ai-elements/prompt-input.tsx` is not to be trimmed; its current
  shape is accepted.
- `MessageResponse` stays because assistant messages render Markdown through
  Streamdown.
- Two primitive libraries remain: `components/ui/combobox.tsx` is the only
  `@base-ui/react` consumer; the rest of the UI is Radix. Keep both for now and
  use Radix for new components unless an exception is recorded in
  `frontend/AGENTS.md`.

## WIP:

No open frontend items. The next cross-cutting priority is backend idempotency
(P0-4 in [`backlog.md`](./backlog.md)), including the frontend key wiring listed
there.

