import type { paths } from "@/src/shared/api/types";

/** A repository from one provider, as returned by `GET /api/v1/repositories`. */
export type GitProviderRepositoryItem =
  paths["/api/v1/repositories"]["get"]["responses"]["200"]["content"]["application/json"][number];

export type GitProviderProject =
  paths["/api/v1/projects"]["get"]["responses"]["200"]["content"]["application/json"]["projects"][number];

export type ChatSession =
  paths["/api/v1/chat/sessions"]["get"]["responses"]["200"]["content"]["application/json"]["sessions"][number];

export type ChatMessage =
  paths["/api/v1/chat/sessions/{id}/messages"]["get"]["responses"]["200"]["content"]["application/json"]["messages"][number];

export type AIModel =
  paths["/api/v1/models"]["get"]["responses"]["200"]["content"]["application/json"]["models"][number];
