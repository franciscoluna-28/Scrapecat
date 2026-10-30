/** Log messages emitted by the projects domain. */
export const PROJECT_LOG_MESSAGES = {
  ingestRetryDefaultBranch:
    "ingest failed; retrying with repo default branch",
  ingestServingStoredRows: "ingest failed; serving existing database rows",
} as const;
