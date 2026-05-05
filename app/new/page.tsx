import { getAllRepositories } from "../actions/github";
import CreateReportClientPage from "./client-page";

export default async function CreateReportPage() {
  const repositories = await getAllRepositories();

  return <CreateReportClientPage repositories={repositories} />;
}
