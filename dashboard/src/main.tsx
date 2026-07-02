import { StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";
import { Toaster } from "sonner";

import "./index.css";
import { queryClient } from "./lib/auth";
import { ProtectedShell } from "./routes/protected";
import { ScreenFallback } from "./components/motion-outlet";
// ProtectedShell stays eager (auth gate + shell); its children suspend into
// MotionOutlet's boundary. The public screens get their own boundary below.
import {
  ApiKeysRoute,
  ConnectionsRoute,
  EnvironmentsRoute,
  EventsRoute,
  LoginRoute,
  MetricsRoute,
  OverviewRoute,
  SettingsRoute,
  Showcase,
  SignupRoute,
  UsageRoute,
} from "./routes/lazy";

const router = createBrowserRouter([
  {
    path: "/",
    element: <ProtectedShell />,
    children: [
      { index: true, element: <Navigate to="/overview" replace /> },
      { path: "overview", element: <OverviewRoute /> },
      { path: "connections", element: <ConnectionsRoute /> },
      { path: "metrics", element: <MetricsRoute /> },
      { path: "events", element: <EventsRoute /> },
      { path: "environments", element: <EnvironmentsRoute /> },
      { path: "keys", element: <ApiKeysRoute /> },
      { path: "usage", element: <UsageRoute /> },
      { path: "settings", element: <SettingsRoute /> },
    ],
  },
  {
    path: "/login",
    element: (
      <Suspense fallback={<ScreenFallback />}>
        <LoginRoute />
      </Suspense>
    ),
  },
  {
    path: "/signup",
    element: (
      <Suspense fallback={<ScreenFallback />}>
        <SignupRoute />
      </Suspense>
    ),
  },
  {
    path: "/showcase",
    element: (
      <Suspense fallback={<ScreenFallback />}>
        <Showcase />
      </Suspense>
    ),
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root not found");
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster
        theme="dark"
        position="bottom-right"
        richColors
        closeButton
        toastOptions={{
          style: {
            background: "var(--color-card)",
            border: "1px solid var(--color-border)",
            color: "var(--color-foreground)",
          },
        }}
      />
    </QueryClientProvider>
  </StrictMode>
);
