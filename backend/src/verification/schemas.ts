import { Type } from "@sinclair/typebox";

export const VerificationOkResponse = Type.Object({
  status: Type.Literal("ok"),
  // Absent in demo mode — the token owner's identity is never exposed.
  github: Type.Optional(
    Type.Object({
      login: Type.String(),
      rateLimitRemaining: Type.Integer(),
    }),
  ),
});

export const VerificationErrorResponse = Type.Object({
  status: Type.Literal("error"),
  message: Type.String(),
});

// The status probe reports failure in-band (HTTP 200 with status: "error") so
// callers can distinguish "GitHub misconfigured" from "endpoint unreachable".
export const VerificationStatusResponse = Type.Union([
  VerificationOkResponse,
  VerificationErrorResponse,
]);
