import { Type } from "@sinclair/typebox";
import { GIT_PROVIDERS } from "@/shared/integrations/git-provider/registry";

export const ErrorResponse = Type.Object({ error: Type.String() });

/** Required provider union, matching the app-layer `GitProviderId`. */
export const GitProviderSchema = Type.Union(
  GIT_PROVIDERS.map((provider) => Type.Literal(provider)),
);

/** Optional provider with a GitHub default (requests that predate providers). */
export const OptionalGitProviderSchema = Type.Optional(
  Type.Union(
    GIT_PROVIDERS.map((provider) => Type.Literal(provider)),
    { default: "github" },
  ),
);
