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

const DEFAULT_ORG_NAME = "Personal";

/**
 * First-run flow for a user with no org. The org is auto-created with a
 * default name (renameable in Settings) so the fresh `prod` API keys appear
 * immediately after signup. We deliberately hold off invalidating `["orgs"]`
 * until the flow finishes, so the org gate keeps us here through the reveal.
 */
export function OnboardingScreen() {
  const qc = useQueryClient();
  const [org, setOrg] = useState<Org | null>(null);
  const started = useRef(false);

  const finish = () => qc.invalidateQueries({ queryKey: ["orgs"] });

  // Intentionally does NOT invalidate ["orgs"] — `finish` controls that.
  const createOrg = useMutation({
    mutationFn: () =>
      api.post<Org>("/api/orgs", { displayName: DEFAULT_ORG_NAME }),
    onSuccess: setOrg,
  });
  const create = createOrg.mutate;

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      create();
    }
  }, [create]);

  if (createOrg.isError) {
    return (
      <AuthShell>
        <Card>
          <CardHeader>
            <CardTitle>Couldn't set up your workspace</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              {orgError(createOrg.error)}
            </p>
            <Button className="w-full" onClick={() => create()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </AuthShell>
    );
  }

  if (!org) {
    return (
      <AuthShell>
        <Card>
          <CardContent className="flex items-center gap-3 pt-5">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary shadow-[0_0_16px_var(--color-primary)]" />
            <p className="text-sm text-muted-foreground">
              Setting up your workspace…
            </p>
          </CardContent>
        </Card>
      </AuthShell>
    );
  }

  return <KeysStep org={org} onFinish={finish} />;
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
          <p className="text-xs text-muted-foreground">
            Your workspace was created as{" "}
            <span className="text-foreground">{org.displayName}</span> — rename
            it any time in{" "}
            <span className="text-foreground">Settings</span>.
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
