import { Type } from "@sinclair/typebox";

export const HealthResponse = Type.Object({
  status: Type.Literal("ok"),
});
