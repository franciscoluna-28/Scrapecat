import { getAllRepositories } from "../../shared/services/github";
import CreateReportClientPage from "./client-page";

export default async function CreateReportPage() {
  const repositories = await getAllRepositories();

  return <CreateReportClientPage repositories={repositories} />;
}
