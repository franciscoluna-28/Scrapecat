"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/src/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import { Badge } from "@/src/components/ui/badge";
import { Skeleton } from "@/src/components/ui/skeleton";
import { Key, Plus, Trash2, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useCredentials, useAddCredential, useDeleteCredential, useVerifyCredential } from "@/src/shared/services/credentials";
import { toast } from "sonner";

const PROVIDERS = [
  { id: "openrouter", label: "OpenRouter" },
  { id: "deepseek", label: "DeepSeek" },
  { id: "openai", label: "OpenAI" },
] as const;

function ProviderIcon({ provider }: { provider: string }) {
  const colors: Record<string, string> = {
    openrouter: "bg-blue-100 text-blue-700",
    deepseek: "bg-purple-100 text-purple-700",
    openai: "bg-green-100 text-green-700",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ${colors[provider] || "bg-muted text-muted-foreground"}`}>
      {provider}
    </span>
  );
}

function AddCredentialDialog({ onClose }: { onClose: () => void }) {
  const [provider, setProvider] = useState("");
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [verifyResult, setVerifyResult] = useState<boolean | null>(null);

  const addCredential = useAddCredential();
  const verifyCredential = useVerifyCredential();

  const handleVerify = async () => {
    if (!provider || !key) return;
    setVerifyResult(null);
    try {
      const result = await verifyCredential.mutateAsync({ provider, key });
      setVerifyResult(result.valid);
      if (!result.valid) {
        toast.error("Key verification failed — check the key and try again");
      } else {
        toast.success("Key verified successfully");
      }
    } catch {
      setVerifyResult(false);
      toast.error("Failed to verify key");
    }
  };

  const handleSave = async () => {
    if (!provider || !key) return;
    try {
      await addCredential.mutateAsync({ provider, key, name: name || undefined });
      toast.success("Credential saved");
      onClose();
    } catch {
      toast.error("Failed to save credential");
    }
  };

  const canVerify = provider && key.length > 0;
  const canSave = provider && key.length > 0 && !addCredential.isPending;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="provider">Provider</Label>
        <Select value={provider} onValueChange={setProvider}>
          <SelectTrigger id="provider">
            <SelectValue placeholder="Select provider" />
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Name (optional)</Label>
        <Input
          id="name"
          placeholder="e.g. Production API Key"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="key">API Key</Label>
        <Input
          id="key"
          type="password"
          placeholder="sk-..."
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
      </div>

      {verifyResult !== null && (
        <div className={`flex items-center gap-2 text-sm ${verifyResult ? "text-green-600" : "text-red-600"}`}>
          {verifyResult ? (
            <><CheckCircle2 className="h-4 w-4" /> Key verified</>
          ) : (
            <><XCircle className="h-4 w-4" /> Verification failed</>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleVerify}
          disabled={!canVerify || verifyCredential.isPending}
        >
          {verifyCredential.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
          Verify
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!canSave}
        >
          {addCredential.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : null}
          Save Key
        </Button>
      </div>
    </div>
  );
}

function CredentialRow({
  credential,
  onDelete,
}: {
  credential: { id: string; provider: string; keyHint: string; createdAt: string };
  onDelete: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(credential.id);
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
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

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
            Store and manage API keys for AI providers. Keys are encrypted at rest.
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
            <AddCredentialDialog onClose={() => setDialogOpen(false)} />
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
              No API keys configured. Add a key for OpenRouter, DeepSeek, or OpenAI to start generating reports.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {credentials.map((cred) => (
            <CredentialRow key={cred.id} credential={cred} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
