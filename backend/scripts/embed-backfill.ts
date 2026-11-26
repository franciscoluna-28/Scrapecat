import "dotenv/config.js";
import { reindexAllProjects } from "@/rag/indexing/reindex-embeddings";

async function main() {
  const result = await reindexAllProjects();
  console.log(
    `Backfill complete. Projects: ${result.projects}. Embeddings written: ${result.embedded}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });
