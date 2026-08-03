import { z } from "zod";
import { Type } from "@sinclair/typebox";

export const addCredentialSchema = z.object({
  provider: z.string().min(1),
  key: z.string().min(1, "API key is required"),
});

export const credentialIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const verifyCredentialSchema = z.object({
  provider: z.string().min(1),
  key: z.string().min(1, "API key is required"),
});

export const listKeysQuerySchema = z.object({
  provider: z.string().optional(),
});

export const AddCredentialBody = Type.Object({
  provider: Type.String(),
  key: Type.String(),
});

const CredentialResponse = Type.Object({
  id: Type.String(),
  provider: Type.String(),
  keyHint: Type.String(),
  createdAt: Type.String({ format: "date-time" }),
});

export const CredentialListResponse = Type.Object({
  keys: Type.Array(CredentialResponse),
});

export const CredentialCreatedResponse = Type.Object({
  id: Type.String(),
});

export const VerifyCredentialBody = Type.Object({
  provider: Type.String(),
  key: Type.String(),
});

export const VerifyCredentialResponse = Type.Object({
  valid: Type.Boolean(),
});
