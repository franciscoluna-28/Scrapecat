import { Header } from "@/_features/shared/components/Header";
import { CreateProjectWrapper } from "@/_features/projects/components/CreateProjectWrapper";
import { getAllRepositories } from "@/app/actions/github";
import Link from "next/link";
import { Folder } from "lucide-react";
import { getAllProjects } from "@/services/sqlite";

export default async function ReposPage() {
  const repositories = await getAllRepositories();
  const recentRepositories = repositories.slice(0, 10);
  const projects = await getAllProjects();

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 border-r bg-background p-4 space-y-6 overflow-y-auto">
          <div>
            <h2 className="text-sm font-medium mb-4">
              Projects ({projects.length})
            </h2>
            {projects.length === 0 ? (
              <div className="text-center py-4">
                <Folder className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No projects yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Create your first project
                </p>
              </div>
            ) : (
              <nav className="space-y-1">
                {projects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="block p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Folder className="h-4 w-4 text-primary" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {project.name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {project.repositoryFullName}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </nav>
            )}
          </div>

          <div className="border-t pt-4">
            <CreateProjectWrapper repositories={recentRepositories} />
          </div>
        </aside>

        <main className="flex flex-1 flex-col overflow-hidden bg-muted/20">
          <section className="grid grid-cols-3 gap-4 border-b border-border p-4 bg-muted/40"></section>

          <section className="flex flex-1 overflow-hidden divide-x divide-border">
            <div className="w-1/2 overflow-y-auto p-4 space-y-4"></div>
            <div className="w-1/2 overflow-y-auto p-4 bg-muted/30"></div>
          </section>
        </main>
      </div>
    </div>
  );
}
