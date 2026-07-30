import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { Button } from "@/src/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
import {
  useAddCredential,
  useVerifyCredential,
} from "@/src/shared/services/credentials";
import { PROVIDERS } from "@/src/shared/constants";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export function AddCredentialDialogContent({ onClose }: { onClose: () => void }) {
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
      await addCredential.mutateAsync({
        provider,
        key,
        name: name || undefined,
      });
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
        <div
          className={`flex items-center gap-2 text-sm ${verifyResult ? "text-green-600" : "text-red-600"}`}
        >
          {verifyResult ? (
            <>
              <CheckCircle2 className="h-4 w-4" /> Key verified
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4" /> Verification failed
            </>
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
          {verifyCredential.isPending ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : null}
          Verify
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!canSave}>
          {addCredential.isPending ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : null}
          Save Key
        </Button>
      </div>
    </div>
  );
}
