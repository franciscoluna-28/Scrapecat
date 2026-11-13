import { env } from "@/shared/config/env";
import { logger } from "@/shared/logger";
import { reportsService } from "@/api/reports/service";

const POLL_INTERVAL_MS = 60_000;

let timer: NodeJS.Timeout | null = null;
let ticking = false;

async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    await reportsService.runDueSchedules();
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error.message : String(error) },
      "report scheduler tick failed",
    );
  } finally {
    ticking = false;
  }
}

export function startReportScheduler(): void {
  if (env.isVercel || env.isDemoMode || timer) return;

  timer = setInterval(() => void tick(), POLL_INTERVAL_MS);
  void (async () => {
    try {
      await reportsService.resetInterruptedSchedules();
    } catch (error) {
      logger.error(
        { err: error instanceof Error ? error.message : String(error) },
        "report scheduler recovery failed",
      );
    }
    await tick();
  })();
  logger.info(
    { intervalMs: POLL_INTERVAL_MS },
    "report scheduler started",
  );
}

export function stopReportScheduler(): void {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
}
