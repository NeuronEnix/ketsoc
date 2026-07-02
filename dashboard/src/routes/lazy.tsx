import { lazy } from "react";

// Lazily-loaded screens so each route ships as its own chunk and the entry
// stays lean. Named exports need the `.then(m => ({ default: m.X }))` shim.
export const Showcase = lazy(() => import("../App"));
export const LandingRoute = lazy(() =>
  import("./landing").then((m) => ({ default: m.LandingRoute }))
);
export const LoginRoute = lazy(() =>
  import("./login").then((m) => ({ default: m.LoginRoute }))
);
export const SignupRoute = lazy(() =>
  import("./signup").then((m) => ({ default: m.SignupRoute }))
);
export const OverviewRoute = lazy(() =>
  import("./overview").then((m) => ({ default: m.OverviewRoute }))
);
export const ConnectionsRoute = lazy(() =>
  import("./connections").then((m) => ({ default: m.ConnectionsRoute }))
);
export const MetricsRoute = lazy(() =>
  import("./metrics").then((m) => ({ default: m.MetricsRoute }))
);
export const EventsRoute = lazy(() =>
  import("./events").then((m) => ({ default: m.EventsRoute }))
);
export const UsageRoute = lazy(() =>
  import("./usage").then((m) => ({ default: m.UsageRoute }))
);
export const SettingsRoute = lazy(() =>
  import("./settings").then((m) => ({ default: m.SettingsRoute }))
);
export const EnvironmentsRoute = lazy(() =>
  import("./environments").then((m) => ({ default: m.EnvironmentsRoute }))
);
export const ApiKeysRoute = lazy(() =>
  import("./api-keys").then((m) => ({ default: m.ApiKeysRoute }))
);
