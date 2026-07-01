import { useState } from "react";
import { toast } from "sonner";

import { useCurrentOrg } from "@/lib/current-org";
import { useUpdateOrg } from "@/lib/orgs";
import { useMe, useLogout } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export function SettingsRoute() {
  const { current } = useCurrentOrg();
  const { data: me } = useMe();
  const orgId = current?.id ?? null;
  const isOwner = current?.role === "owner";
  const updateOrg = useUpdateOrg(orgId);
  const logout = useLogout();

  const [name, setName] = useState("");
  const displayName = name || current?.displayName || "";
  const dirty = displayName.trim() !== (current?.displayName ?? "");
  const valid = displayName.trim().length > 0 && displayName.trim().length <= 40;

  function save() {
    updateOrg.mutate(displayName.trim(), {
      onSuccess: (org) => {
        setName("");
        toast.success(`Renamed to ${org.displayName}`);
      },
      onError: (e) =>
        toast.error(
          e instanceof ApiError ? e.message : "Couldn't rename the organization"
        ),
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-lg font-semibold tracking-tight">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Organization</CardTitle>
          <CardDescription>
            The display name for{" "}
            <span className="font-medium text-foreground">
              {current?.displayName ?? "your organization"}
            </span>
            . The handle is permanent.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="org-display-name">Display name</Label>
            <div className="flex items-start gap-2">
              <Input
                id="org-display-name"
                value={displayName}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                disabled={!isOwner}
                className="max-w-xs"
              />
              <Button
                disabled={!isOwner || !dirty || !valid || updateOrg.isPending}
                onClick={save}
              >
                {updateOrg.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
            {!isOwner ? (
              <p className="text-xs text-muted-foreground">
                Only owners can rename the organization.
              </p>
            ) : null}
          </div>
          {orgId ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Org ID</span>
              <code className="font-mono text-foreground">{orgId}</code>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm text-foreground">
                {me?.email ?? "—"}
              </span>
              <span className="text-xs text-muted-foreground">
                Signed in {current ? "as " : ""}
                {current ? (
                  <Badge variant="outline" className="ml-1 text-[10px]">
                    {current.role}
                  </Badge>
                ) : null}
              </span>
            </div>
            <Button
              variant="outline"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
