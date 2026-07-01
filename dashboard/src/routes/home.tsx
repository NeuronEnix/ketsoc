import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLogout, type AuthUser } from "@/lib/auth";

/** Placeholder authenticated landing — the app shell + screens land next. */
export function HomeRoute({ user }: { user: AuthUser }) {
  const logout = useLogout();
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <Card>
          <CardHeader>
            <CardTitle>You're in 🎉</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Authenticated as{" "}
              <span className="font-mono text-foreground">{user.email}</span>.
              The dashboard shell and observability screens land next.
            </p>
            <Button
              variant="outline"
              className="self-start"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
            >
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
