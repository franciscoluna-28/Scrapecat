import "dotenv/config.js";
import { db } from "@/db/client";
import { commitChunks } from "@/db/schema";
import { embedNewChunks } from "@/projects/embed-chunks";

async function main() {
  const projects = await db
    .selectDistinct({ projectId: commitChunks.projectId })
    .from(commitChunks);

  let total = 0;
  for (const project of projects) {
    const result = await embedNewChunks(project.projectId);
    total += result.embedded;
    console.log(`project ${project.projectId}: embedded ${result.embedded}`);
  }
  console.log(`Backfill complete. Total embeddings written: ${total}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });
