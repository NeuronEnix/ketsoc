import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useCurrentOrg } from "@/lib/current-org";
import { useEnvs, useCreateEnv, useDeleteEnv } from "@/lib/envs";
import { ApiError } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const ENV_NAME_RE = /^[a-z]{4}$/;

function envError(e: unknown): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case "INVALID_NAME":
        return "Exactly 4 lowercase letters.";
      case "RESERVED_NAME":
        return "'prod' is reserved.";
      case "NAME_TAKEN":
        return "That name is already taken.";
      case "ENV_LIMIT":
        return "Max 5 environments per org.";
      case "PROTECTED":
        return "prod can't be deleted.";
      default:
        return e.message;
    }
  }
  return "Something went wrong.";
}

export function EnvironmentsRoute() {
  const { current } = useCurrentOrg();
  const orgId = current?.id ?? null;
  const envs = useEnvs(orgId);
  const createEnv = useCreateEnv(orgId);
  const deleteEnv = useDeleteEnv(orgId);
  const [name, setName] = useState("");
  const valid = ENV_NAME_RE.test(name);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Environments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Isolated groupings, each with its own API keys. Exactly 4 lowercase
          letters; <span className="font-mono text-foreground">prod</span> is
          reserved.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create environment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2">
            <div className="flex flex-col gap-1">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value.toLowerCase())}
                placeholder="e.g. stag"
                maxLength={4}
                className="w-40 font-mono"
                aria-label="Environment name"
              />
              {createEnv.isError ? (
                <p className="text-xs text-destructive">
                  {envError(createEnv.error)}
                </p>
              ) : null}
            </div>
            <Button
              disabled={!valid || createEnv.isPending}
              onClick={() =>
                createEnv.mutate(name, {
                  onSuccess: (env) => {
                    setName("");
                    toast.success(`Environment ${env.name} created`);
                  },
                  onError: (e) => toast.error(envError(e)),
                })
              }
            >
              {createEnv.isPending ? "…" : "Create"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2">
        {envs.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : null}
        {(envs.data ?? []).map((env) => (
          <div
            key={env.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3"
          >
            <span className="font-mono text-sm font-medium">{env.name}</span>
            {env.mode === "live" ? (
              <Badge variant="success">live</Badge>
            ) : (
              <Badge variant="test">test mode</Badge>
            )}
            <div className="ml-auto flex items-center gap-2">
              {env.isPermanent ? (
                <span className="text-xs text-muted-foreground">permanent</span>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    deleteEnv.mutate(env.id, {
                      onSuccess: () =>
                        toast.success(`Environment ${env.name} deleted`),
                      onError: (e) => toast.error(envError(e)),
                    })
                  }
                  disabled={deleteEnv.isPending}
                  aria-label={`Delete ${env.name}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
