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
import { ProtectedHome } from "./routes/protected";

const router = createBrowserRouter([
  { path: "/", element: <ProtectedHome /> },
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
