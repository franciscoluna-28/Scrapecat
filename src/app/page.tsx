import { redirect } from "next/navigation";
import Link from "next/link";

export default async function Home() {
  if (process.env.NODE_ENV === "production") {
    redirect("/demo");
  }

  return (
    <div className="flex min-h-screen items-center justify-center gap-4">
      <Link href="/demo" className="text-blue-600 underline">Demo</Link>
      <Link href="/new" className="text-blue-600 underline">Full App</Link>
    </div>
  );
}
