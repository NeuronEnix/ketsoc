import { Link, useNavigate } from "react-router-dom";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSignup } from "@/lib/auth";
import { authErrorMessage } from "@/lib/api";
import { AuthForm } from "./auth-form";
import { AuthShell } from "./auth-shell";

export function SignupRoute() {
  const signup = useSignup();
  const navigate = useNavigate();

  return (
    <AuthShell>
      <Card>
        <CardHeader>
          <CardTitle>Create your ketsoc account</CardTitle>
          <CardDescription>Real-time sockets in minutes.</CardDescription>
        </CardHeader>
        <CardContent>
          <AuthForm
            mode="signup"
            pending={signup.isPending}
            error={signup.isError ? authErrorMessage(signup.error) : null}
            onSubmit={(v) =>
              signup.mutate(v, { onSuccess: () => navigate("/") })
            }
          />
          <p className="mt-4 text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
