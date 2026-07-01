import { Navigate } from "react-router-dom";

import { useMe } from "@/lib/auth";
import { HomeRoute } from "./home";

/** Gate the app behind auth: loading → spinner, no user → /login, else home. */
export function ProtectedHome() {
  const { data: user, isLoading } = useMe();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="h-3 w-3 animate-pulse rounded-full bg-primary shadow-[0_0_20px_var(--color-primary)]" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <HomeRoute user={user} />;
}
