import { useState } from "react";

import { useCreateOrg } from "@/lib/orgs";
import { ApiError } from "@/lib/api";
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
 * Shown when an authenticated user belongs to no org yet. Naming the org
 * creates it and (server-side) seeds `prod` + `test`, after which the org
 * list refetches and the app shell takes over — landing on the Overview.
 */
export function OnboardingScreen() {
  const createOrg = useCreateOrg();
  const [name, setName] = useState("");
  const valid = name.trim().length > 0 && name.trim().length <= 40;

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
