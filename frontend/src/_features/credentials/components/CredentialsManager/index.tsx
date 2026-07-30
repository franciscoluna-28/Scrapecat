"use client";

import { useState } from "react";
import { Card, CardContent } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import { Skeleton } from "@/src/components/ui/skeleton";
import { Key, Plus, XCircle } from "lucide-react";
import {
  useCredentials,
  useDeleteCredential,
} from "@/src/_features/credentials/services";
import { toast } from "sonner";
import { AddCredentialDialogContent } from "../AddCredentialDialogContent";
import { CredentialRow } from "../CredentialRow";

export function CredentialsManager() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { credentials, isLoading, error } = useCredentials();
  const deleteCredential = useDeleteCredential();

  const handleDelete = async (id: string) => {
    try {
      await deleteCredential.mutateAsync(id);
      toast.success("Credential deleted");
    } catch {
      toast.error("Failed to delete credential");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">API Keys</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Store and manage API keys for AI providers. Keys are encrypted at
            rest.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              Add Key
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add API Key</DialogTitle>
            </DialogHeader>
            <AddCredentialDialogContent onClose={() => setDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-6 text-center">
            <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-red-600">Failed to load credentials</p>
          </CardContent>
        </Card>
      ) : credentials.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <Key className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No API keys configured. Add a key for OpenRouter, DeepSeek, or
              OpenAI to start generating reports.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {credentials.map((cred) => (
            <CredentialRow
              key={cred.id}
              credential={cred}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
