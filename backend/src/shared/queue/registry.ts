import type { JobHandler } from "./job-queue";

const handlers = new Map<string, JobHandler>();

export function registerJobHandler(name: string, handler: JobHandler): void {
  handlers.set(name, handler);
}

export function getJobHandler(name: string): JobHandler | undefined {
  return handlers.get(name);
}

/** Test hook: clears registrations so a suite can install fakes. */
export function resetJobHandlers(): void {
  handlers.clear();
}
