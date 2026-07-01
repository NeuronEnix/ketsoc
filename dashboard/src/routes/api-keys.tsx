import { useState } from "react";
import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useCurrentOrg } from "@/lib/current-org";
import { useEnvs } from "@/lib/envs";
import { ApiError } from "@/lib/api";
import {
  useKeys,
  useCreateKey,
  useRevokeKey,
  type ApiKeyType,
} from "@/lib/keys";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ApiKeysRoute() {
  const { current } = useCurrentOrg();
  const orgId = current?.id ?? null;
  const envs = useEnvs(orgId).data ?? [];
  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(null);
  const activeEnv = envs.find((e) => e.id === selectedEnvId) ?? envs[0] ?? null;
  const envId = activeEnv?.id ?? null;

  const keysQ = useKeys(orgId, envId);
  const createKey = useCreateKey(orgId, envId);
  const revokeKey = useRevokeKey(orgId, envId);

  const [label, setLabel] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function create(type: ApiKeyType) {
    createKey.mutate(
      { type, label: label.trim() || null },
      {
        onSuccess: (k) => {
          setRevealed(k.key);
          setLabel("");
          toast.success(
            `${type === "secret" ? "Secret" : "Public"} key created — copy it now`
          );
        },
        onError: (e) =>
          toast.error(
            e instanceof ApiError ? e.message : "Couldn't create the key"
          ),
      }
    );
  }

  function revoke(keyId: string, prefix: string) {
    revokeKey.mutate(keyId, {
      onSuccess: () => toast.success(`Revoked ${prefix}…`),
      onError: () => toast.error("Couldn't revoke the key"),
    });
  }

  async function copy() {
    if (!revealed) {
      return;
    }
    try {
      await navigator.clipboard.writeText(revealed);
      setCopied(true);
      toast.success("Key copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — copy it manually");
    }
  }

  const keys = keysQ.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">API Keys</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Public keys (
          <span className="font-mono text-violet-bright">kpk</span>) connect
          clients; secret keys (
          <span className="font-mono text-violet-bright">ksk</span>) publish and
          mint tokens. Secrets are shown once.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {envs.map((env) => (
          <button
            key={env.id}
            type="button"
            onClick={() => setSelectedEnvId(env.id)}
            className={cn(
              "rounded-md border px-3 py-1.5 font-mono text-sm transition-colors",
              env.id === envId
                ? "border-primary/50 bg-primary/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-accent"
            )}
          >
            {env.name}
          </button>
        ))}
        {envs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No environments yet — create one first.
          </p>
        ) : null}
      </div>

      {revealed ? (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle>Copy your new key now</CardTitle>
            <CardDescription>
              For your security, the secret won&apos;t be shown again.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
              <code className="flex-1 truncate font-mono text-xs text-foreground">
                {revealed}
              </code>
              <Button size="sm" variant="outline" onClick={copy}>
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => setRevealed(null)}
            >
              Done
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {activeEnv ? (
        <Card>
          <CardHeader>
            <CardTitle>Create key in {activeEnv.name}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Label (optional)"
              className="w-56"
              aria-label="Key label"
            />
            <Button
              variant="secondary"
              disabled={createKey.isPending}
              onClick={() => create("public")}
            >
              Public key
            </Button>
            <Button
              disabled={createKey.isPending}
              onClick={() => create("secret")}
            >
              Secret key
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-2">
        {keysQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : null}
        {keys.map((k) => (
          <div
            key={k.id}
            className={cn(
              "flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3",
              k.revokedAt !== null && "opacity-50"
            )}
          >
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            <code className="font-mono text-xs text-foreground">
              {k.keyPrefix}…
            </code>
            <Badge variant={k.type === "secret" ? "warning" : "default"}>
              {k.type === "secret" ? "ksk" : "kpk"}
            </Badge>
            {k.label ? (
              <span className="text-sm text-muted-foreground">{k.label}</span>
            ) : null}
            <div className="ml-auto flex items-center gap-2">
              {k.revokedAt !== null ? (
                <span className="text-xs text-muted-foreground">revoked</span>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => revoke(k.id, k.keyPrefix)}
                  disabled={revokeKey.isPending}
                  aria-label={`Revoke ${k.keyPrefix}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        ))}
        {!keysQ.isLoading && keys.length === 0 && activeEnv ? (
          <p className="text-sm text-muted-foreground">
            No keys yet in {activeEnv.name}.
          </p>
        ) : null}
      </div>
    </div>
  );
}
