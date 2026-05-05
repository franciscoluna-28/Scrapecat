import { createSafeActionClient } from "next-safe-action";

export const actionClient = createSafeActionClient({
  handleServerError(e: Error) {
    console.error("Server action error:", e);
    return e.message;
  },
});

