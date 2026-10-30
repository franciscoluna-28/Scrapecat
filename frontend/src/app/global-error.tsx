"use client";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            {error.message || "An unexpected error occurred."}
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
