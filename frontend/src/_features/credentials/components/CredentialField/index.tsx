"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import { Input } from "@/src/components/ui/input";
import { Button } from "@/src/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/src/components/ui/alert-dialog";
import {
  useAddCredential,
  useDeleteCredential,
  useVerifyCredential,
} from "@/src/_features/credentials/services";
import { ProviderIcon } from "../ProviderIcon";

export function CredentialField({
  provider,
  credential,
}: {
  provider: { id: string; label: string };
  credential?: {
    id: string;
    provider: string;
    keyHint: string;
    createdAt: string;
  };
}) {
  const [key, setKey] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const addCredential = useAddCredential();
  const verifyCredential = useVerifyCredential();
  const deleteCredential = useDeleteCredential();

  const handleSave = async () => {
    if (!key) return;
    try {
      const result = await verifyCredential.mutateAsync({
        provider: provider.id,
        key,
      });
      if (!result.valid) {
        toast.error(`${provider.label} key verification failed`);
        return;
      }
      await addCredential.mutateAsync({ provider: provider.id, key });
      setKey("");
      toast.success(`${provider.label} key saved and verified`);
    } catch {
      toast.error("Failed to save key");
    }
  };

  const handleDelete = async () => {
    if (!credential) return;
    try {
      await deleteCredential.mutateAsync(credential.id);
      toast.success(`${provider.label} key deleted`);
    } catch {
      toast.error("Failed to delete key");
    } finally {
      setDeleteOpen(false);
    }
  };

  const canSave = key.length > 0 && !addCredential.isPending;

  return (
    <div className="rounded-lg border px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center min-w-[130px]">
          <ProviderIcon provider={provider.id} />
        </div>

        <Input
          type="password"
          placeholder={
            credential ? `${credential.keyHint} (configured)` : "sk-..."
          }
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className="flex-1 min-w-0 font-mono"
        />

        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" onClick={handleSave} disabled={!canSave}>
            {addCredential.isPending || verifyCredential.isPending ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : null}
            Save
          </Button>
          <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-red-600"
                disabled={!credential}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            {credential && (
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete {provider.label} key?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove the stored API key for {provider.label}.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={deleteCredential.isPending}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleteCredential.isPending}
                  >
                    {deleteCredential.isPending ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : null}
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            )}
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
