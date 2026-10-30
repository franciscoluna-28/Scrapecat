"use client";

import { useEffect } from "react";
import { Button } from "@/src/components/ui/button";


export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred."}
      </p>
      <Button
        onClick={() => unstable_retry()}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Try again
      </Button>
    </div>
  );
}
