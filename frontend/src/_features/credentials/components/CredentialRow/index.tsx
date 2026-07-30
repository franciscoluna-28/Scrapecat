import { Button } from "@/src/components/ui/button";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { ProviderIcon } from "../ProviderIcon";

export function CredentialRow({
  credential,
  onDelete,
}: {
  credential: {
    id: string;
    provider: string;
    keyHint: string;
    createdAt: string;
  };
  onDelete: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      onDelete(credential.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex items-center justify-between rounded-lg border px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <ProviderIcon provider={credential.provider} />
        <span className="font-mono text-sm text-muted-foreground truncate">
          {credential.keyHint}
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs text-muted-foreground hidden sm:inline">
          {new Date(credential.createdAt).toLocaleDateString()}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-red-600"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
