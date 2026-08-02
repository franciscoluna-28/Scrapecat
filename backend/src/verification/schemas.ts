import { Type } from "@sinclair/typebox";

export const VerificationOkResponse = Type.Object({
  status: Type.Literal("ok"),
  github: Type.Object({
    login: Type.String(),
    rateLimitRemaining: Type.Integer(),
  }),
});

export const VerificationErrorResponse = Type.Object({
  status: Type.Literal("error"),
  message: Type.String(),
});
