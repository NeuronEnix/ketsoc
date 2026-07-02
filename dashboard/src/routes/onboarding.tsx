import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { api, ApiError } from "@/lib/api";
import type { Org } from "@/lib/orgs";
import { useEnvs } from "@/lib/envs";
import { useCreateKey, type CreatedKey } from "@/lib/keys";
import { AuthShell } from "@/routes/auth-shell";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

function orgError(e: unknown): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case "INVALID_NAME":
        return "Give your organization a name (1–40 characters).";
      case "ORG_LIMIT":
        return "You've reached the limit of 5 organizations.";
      default:
        return e.message;
    }
  }
  return "Something went wrong.";
}

/**
 * First-run flow for a user with no org. Step 1 names the org (server seeds
 * `prod` + `test`); step 2 reveals the fresh `prod` API keys. We deliberately
 * hold off invalidating `["orgs"]` until the flow finishes, so the org gate
 * keeps us here through both steps instead of jumping to the shell.
 */
export function OnboardingScreen() {
  const qc = useQueryClient();
  const [org, setOrg] = useState<Org | null>(null);

  const finish = () => qc.invalidateQueries({ queryKey: ["orgs"] });

  return org ? (
    <KeysStep org={org} onFinish={finish} />
  ) : (
    <OrgStep onCreated={setOrg} />
  );
}

function OrgStep({ onCreated }: { onCreated: (org: Org) => void }) {
  const [name, setName] = useState("");
  const valid = name.trim().length > 0 && name.trim().length <= 40;

  // Intentionally does NOT invalidate ["orgs"] — the parent controls that.
  const createOrg = useMutation({
    mutationFn: (displayName: string) =>
      api.post<Org>("/api/orgs", { displayName }),
    onSuccess: (org) => {
      toast.success(`Welcome to ${org.displayName} 🎉`);
      onCreated(org);
    },
    onError: (e) => toast.error(orgError(e)),
  });

  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <CardTitle>Create your organization</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Your workspace for API keys, environments, and realtime metrics.
            We'll seed a{" "}
            <span className="font-mono text-foreground">prod</span> and{" "}
            <span className="font-mono text-foreground">test</span> environment
            to get you started.
          </p>
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (valid && !createOrg.isPending) {
                createOrg.mutate(name.trim());
              }
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="org-name">Organization name</Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Inc"
                maxLength={40}
                autoFocus
              />
              {createOrg.isError ? (
                <p className="text-xs text-destructive">
                  {orgError(createOrg.error)}
                </p>
              ) : null}
            </div>
            <Button
              type="submit"
              disabled={!valid || createOrg.isPending}
              className="w-full"
            >
              {createOrg.isPending ? "Creating…" : "Create organization"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthShell>
  );
}

function KeyRow({ k }: { k: CreatedKey }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(k.key);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — copy it manually");
    }
  }
  return (
    <div className="flex flex-col gap-1">
      <Badge
        variant={k.type === "secret" ? "warning" : "default"}
        className="self-start"
      >
        {k.type === "secret" ? "ksk · secret" : "kpk · publishable"}
      </Badge>
      <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
        <code className="flex-1 truncate font-mono text-xs text-foreground">
          {k.key}
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
    </div>
  );
}

function KeysStep({ org, onFinish }: { org: Org; onFinish: () => void }) {
  const envs = useEnvs(org.id);
  const prod = envs.data?.find((e) => e.name === "prod") ?? null;
  const createKey = useCreateKey(org.id, prod?.id ?? null);
  const [keys, setKeys] = useState<CreatedKey[]>([]);
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!prod || started.current) {
      return;
    }
    started.current = true;
    createKey.mutate(
      { type: "public", label: "Default" },
      {
        onSuccess: (pub) => {
          setKeys((prev) => [...prev, pub]);
          createKey.mutate(
            { type: "secret", label: "Default" },
            {
              onSuccess: (sec) => setKeys((prev) => [...prev, sec]),
              onError: () => setFailed(true),
            }
          );
        },
        onError: () => setFailed(true),
      }
    );
    // Runs once, when the seeded prod env becomes available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prod?.id]);

  const ready = keys.length >= 2;

  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <CardTitle>Your API keys</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Fresh keys for{" "}
            <span className="font-mono text-foreground">prod</span>. The secret
            (<span className="font-mono text-foreground">ksk</span>) is shown{" "}
            <span className="text-foreground">once</span> — store it now.
          </p>

          {keys.map((k) => (
            <KeyRow key={k.id} k={k} />
          ))}

          {!ready && !failed ? (
            <p className="text-sm text-muted-foreground">Generating keys…</p>
          ) : null}
          {failed ? (
            <p className="text-sm text-muted-foreground">
              You can create keys anytime from the API Keys screen.
            </p>
          ) : null}

          <Button className="w-full" onClick={onFinish}>
            Continue to dashboard
          </Button>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
