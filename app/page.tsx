import { Header } from "@/_features/shared/components/Header";
import { Sidebar } from "@/_features/shared/components/Sidebar";
import { getAllRepositories } from "@/app/actions/github";
import { getAllProjects } from "@/services/sqlite";
import { MarkdownEditor } from "@/_features/shared/components/MarkdownEditor";

export default async function Home() {
  const repositories = await getAllRepositories();
  const recentRepositories = repositories.slice(0, 10);
  const projects = await getAllProjects();

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex flex-1 flex-col overflow-hidden bg-muted/20">
          <div className="flex flex-1 h-full divide-x divide-border">
            {/* Chat UI Section */}
            <div className="w-1/2 overflow-y-auto p-4 border-r border-border">
              <div className="h-full flex flex-col">
                <h2 className="text-xl font-semibold mb-4">Chat Interface</h2>
                <div className="flex-1 bg-background border rounded-lg p-4">
                  <div className="text-center text-muted-foreground">
                    <div className="mb-4">
                      <div className="w-16 h-16 bg-muted rounded-full mx-auto mb-2 flex items-center justify-center">
                        <span className="text-2xl">💬</span>
                      </div>
                    </div>
                    <p className="text-sm">Chat interface coming soon...</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Connect your repositories and start analyzing commits with AI
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Markdown Editor Section */}
            <div className="w-1/2 overflow-y-auto p-4 bg-muted/30">
              <MarkdownEditor />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
