import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
} from "react-router-dom";

import "./index.css";
import { queryClient } from "./lib/auth";
import Showcase from "./App";
import { LoginRoute } from "./routes/login";
import { SignupRoute } from "./routes/signup";
import { ProtectedShell } from "./routes/protected";
import { OverviewRoute } from "./routes/overview";
import { ConnectionsRoute } from "./routes/connections";
import { MetricsRoute } from "./routes/metrics";
import { EnvironmentsRoute } from "./routes/environments";
import { ApiKeysRoute } from "./routes/api-keys";
import { Placeholder } from "./routes/placeholder";

const router = createBrowserRouter([
  {
    path: "/",
    element: <ProtectedShell />,
    children: [
      { index: true, element: <Navigate to="/overview" replace /> },
      { path: "overview", element: <OverviewRoute /> },
      { path: "connections", element: <ConnectionsRoute /> },
      { path: "metrics", element: <MetricsRoute /> },
      { path: "events", element: <Placeholder title="Events / Tail" /> },
      { path: "environments", element: <EnvironmentsRoute /> },
      { path: "keys", element: <ApiKeysRoute /> },
      { path: "usage", element: <Placeholder title="Usage" /> },
      { path: "settings", element: <Placeholder title="Settings" /> },
    ],
  },
  { path: "/login", element: <LoginRoute /> },
  { path: "/signup", element: <SignupRoute /> },
  { path: "/showcase", element: <Showcase /> },
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
    </QueryClientProvider>
  </StrictMode>
);
