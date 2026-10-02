/**
 * BullMQ only persists a job's failure as a `failedReason` string, which would
 * drop the `code` field routes rely on (e.g. `BranchNotFound` → 400). We encode
 * `{ message, code }` as JSON in the failure and decode it back on the waiter.
 */
export function serializeJobError(error: unknown): string {
  const err = error as { message?: string; code?: string };
  return JSON.stringify({
    message: err?.message ?? String(error),
    code: err?.code,
  });
}

export function deserializeJobError(raw: string | null | undefined): Error {
  if (!raw) return new Error("Job failed");
  try {
    const parsed = JSON.parse(raw) as { message?: string; code?: string };
    if (parsed && typeof parsed.message === "string") {
      const error = new Error(parsed.message);
      if (parsed.code) (error as { code?: string }).code = parsed.code;
      return error;
    }
  } catch {
    // Not one of our encoded failures — fall through to a plain Error.
  }
  return new Error(raw);
}
