import { Link, useNavigate } from "react-router-dom";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLogin } from "@/lib/auth";
import { authErrorMessage } from "@/lib/api";
import { AuthForm } from "./auth-form";
import { AuthShell } from "./auth-shell";

export function LoginRoute() {
  const login = useLogin();
  const navigate = useNavigate();

  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <CardTitle>Sign in to ketsoc</CardTitle>
          <CardDescription>Welcome back.</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm
            mode="login"
            pending={login.isPending}
            error={login.isError ? authErrorMessage(login.error) : null}
            onSubmit={(v) =>
              login.mutate(v, { onSuccess: () => navigate("/overview") })
            }
          />
          <p className="mt-4 text-sm text-muted-foreground">
            No account?{" "}
            <Link to="/signup" className="text-primary hover:underline">
              Create one
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
