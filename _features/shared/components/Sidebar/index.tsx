import { CreateProjectWrapper } from "@/_features/projects/components/CreateProjectWrapper";
import { GitHubRepository } from "@/app/actions/github";
import { projects } from "@/lib/db/schema";
import { Folder } from "lucide-react";
import Link from "next/link";

type Props = {
    projects: typeof projects.$inferSelect[];
    recentRepositories: GitHubRepository[];
}

export function Sidebar({ projects, recentRepositories }: Props) {
    return (
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
    )
}