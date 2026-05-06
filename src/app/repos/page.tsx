export default async function ReposPage() {
  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4">Repositories</h1>
          <p className="text-muted-foreground">Use the sidebar to navigate and manage repositories</p>
        </div>
      </div>
    </div>
  );
}
