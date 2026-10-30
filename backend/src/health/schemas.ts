import { Type } from "@sinclair/typebox";

export const HealthResponse = Type.Object({
  status: Type.Literal("ok"),
});

export const HealthReadyResponse = Type.Object({
  status: Type.Union([Type.Literal("ok"), Type.Literal("error")]),
});
