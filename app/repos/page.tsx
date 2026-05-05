import { Header } from "@/_features/shared/components/Header";
import { Sidebar } from "@/_features/shared/components/Sidebar";
import { getAllRepositories } from "@/app/actions/github";
import { getAllProjects } from "@/services/sqlite";

export default async function ReposPage() {
  const repositories = await getAllRepositories();
  const recentRepositories = repositories.slice(0, 10);
  const projects = await getAllProjects();

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
    
    </div>
  );
}
