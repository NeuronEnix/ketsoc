import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  LazyMotion,
  domAnimation,
  m,
  useReducedMotion,
} from "framer-motion";
import {
  Activity,
  ArrowRight,
  Command,
  KeyRound,
  Layers,
  Users,
  Zap,
} from "lucide-react";

import { useMe } from "@/lib/auth";
import { LineChart } from "@/components/line-chart";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Smooth, deterministic "tail latency" curve for the hero chart (ms). */
function latencyAt(x: number): number {
  return (
    42 +
    9 * Math.sin(x / 4.7) +
    5 * Math.sin(x / 1.9 + 1.3) +
    3 * Math.sin(x / 9.3 + 0.4)
  );
}

function Logo() {
  return (
    <span className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_12px_var(--color-primary)]" />
      <span className="font-mono text-lg font-semibold tracking-tight">
        ket<span className="text-primary">soc</span>
      </span>
    </span>
  );
}

function Nav({ authed }: { authed: boolean }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link to="/" aria-label="ketsoc home">
          <Logo />
        </Link>
        <nav className="flex items-center gap-2">
          {authed ? (
            <Link to="/overview" className={buttonVariants({ size: "sm" })}>
              Open dashboard <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className={buttonVariants({ size: "sm", variant: "ghost" })}
              >
                Sign in
              </Link>
              <Link to="/signup" className={buttonVariants({ size: "sm" })}>
                Start building <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function CodeCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_0_60px_-20px_var(--color-primary)]">
      <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
        <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
        <span className="ml-2 font-mono text-xs text-muted-foreground">
          app.ts
        </span>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-6">
        <code>
          <span className="text-magenta">import</span>
          <span className="text-foreground"> {"{ ketsoc }"} </span>
          <span className="text-magenta">from</span>
          <span className="text-success"> "@ketsoc/client"</span>
          <span className="text-muted-foreground">;</span>
          {"\n\n"}
          <span className="text-magenta">const</span>
          <span className="text-foreground"> rt </span>
          <span className="text-muted-foreground">= </span>
          <span className="text-info">ketsoc</span>
          <span className="text-muted-foreground">(</span>
          <span className="text-success">"kpk.prod.k3y…"</span>
          <span className="text-muted-foreground">);</span>
          {"\n\n"}
          <span className="text-foreground">rt</span>
          <span className="text-muted-foreground">.</span>
          <span className="text-info">subscribe</span>
          <span className="text-muted-foreground">(</span>
          <span className="text-success">"chat:lobby"</span>
          <span className="text-muted-foreground">, (</span>
          <span className="text-foreground">msg</span>
          <span className="text-muted-foreground">) {"=>"} </span>
          <span className="text-info">render</span>
          <span className="text-muted-foreground">(</span>
          <span className="text-foreground">msg</span>
          <span className="text-muted-foreground">));</span>
          {"\n"}
          <span className="text-foreground">rt</span>
          <span className="text-muted-foreground">.</span>
          <span className="text-info">publish</span>
          <span className="text-muted-foreground">(</span>
          <span className="text-success">"chat:lobby"</span>
          <span className="text-muted-foreground">, {"{ "}</span>
          <span className="text-foreground">text</span>
          <span className="text-muted-foreground">: </span>
          <span className="text-success">"hello from the edge ⚡"</span>
          <span className="text-muted-foreground">{" }"});</span>
        </code>
      </pre>
    </div>
  );
}

function LiveChartCard() {
  const reduce = useReducedMotion();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (reduce) {
      return;
    }
    const id = setInterval(() => setTick((t) => t + 1), 1200);
    return () => clearInterval(id);
  }, [reduce]);

  const data = useMemo(
    () => Array.from({ length: 40 }, (_, i) => ({ v: latencyAt(i + tick) })),
    [tick]
  );
  const sorted = [...data.map((d) => d.v)].sort((a, b) => a - b);
  const pct = (p: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-medium">Publish latency</p>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          live
        </span>
      </div>
      <LineChart
        data={data}
        series={[
          { label: "p99", color: "var(--primary)", accessor: (d) => d.v },
        ]}
        height={120}
        area
        formatValue={(n) => `${n.toFixed(1)} ms`}
      />
      <div className="mt-3 grid grid-cols-3 gap-2">
        {(
          [
            ["p50", pct(0.5)],
            ["p95", pct(0.95)],
            ["p99.9", pct(0.999)],
          ] as const
        ).map(([label, v]) => (
          <div
            key={label}
            className="rounded-md border border-border bg-background px-3 py-2"
          >
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p className="font-mono text-sm font-semibold tabular-nums">
              {v.toFixed(1)}
              <span className="ml-0.5 text-xs text-muted-foreground">ms</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

const STATS: Array<[string, string]> = [
  ["< 50 ms", "p99 publish latency"],
  ["330+", "edge locations"],
  ["p99.9", "tail latency on every chart"],
  ["~60 s", "signup to first message"],
];

const FEATURES = [
  {
    icon: Zap,
    title: "Edge-native core",
    body: "Durable Objects keep connection state in the city where your users are — not a region three oceans away.",
  },
  {
    icon: Activity,
    title: "Observability built in",
    body: "Live connections, throughput, events, and tail latency down to p99.9 — a dashboard you'd pay extra for, included.",
  },
  {
    icon: KeyRound,
    title: "Reveal-once keys",
    body: "Publishable and secret keys per environment, SHA-256 at rest, shown exactly once. Rotate without fear.",
  },
  {
    icon: Layers,
    title: "Isolated environments",
    body: "prod is sacred and permanent; everything else is test mode by design. No accidental writes to production.",
  },
  {
    icon: Users,
    title: "Multi-tenant orgs",
    body: "Workspaces for every project or team, switchable in two clicks. Your side project and your day job stay apart.",
  },
  {
    icon: Command,
    title: "⌘K everything",
    body: "Jump to any screen from anywhere. The dashboard is fast because your incident won't wait for a page load.",
  },
];

export function LandingRoute() {
  const { data: user } = useMe();
  const reduce = useReducedMotion();

  const enter = (delay: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.5,
      delay: reduce ? 0 : delay,
      ease: "easeOut" as const,
    },
  });

  return (
    <LazyMotion features={domAnimation} strict>
      <div className="min-h-screen bg-background text-foreground">
        <Nav authed={Boolean(user)} />

        {/* Hero */}
        <section className="relative overflow-hidden pt-36 pb-20">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(124,92,255,0.07)_1px,transparent_1px)] bg-[size:26px_26px]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-48 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-primary/20 blur-[140px]"
          />
          <div className="relative mx-auto max-w-6xl px-6">
            <m.div {...enter(0)} className="flex justify-center">
              <Badge variant="outline" className="gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                Developer preview — the dashboard is live
              </Badge>
            </m.div>

            <m.h1
              {...enter(0.08)}
              className="mx-auto mt-6 max-w-5xl text-center text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl"
            >
              Sockets at the edge.
              <br />
              <span className="bg-gradient-to-r from-primary via-magenta to-info bg-clip-text text-transparent">
                Observability at the core.
              </span>
            </m.h1>

            <m.p
              {...enter(0.16)}
              className="mx-auto mt-6 max-w-2xl text-center text-lg text-muted-foreground"
            >
              ketsoc is a globally-distributed realtime messaging service on
              Cloudflare's edge network. Publish and subscribe in milliseconds —
              and watch every connection, message, and tail latency, live.
            </m.p>

            <m.div
              {...enter(0.24)}
              className="mt-8 flex items-center justify-center gap-3"
            >
              {user ? (
                <Link to="/overview" className={buttonVariants({ size: "lg" })}>
                  Open dashboard <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <>
                  <Link to="/signup" className={buttonVariants({ size: "lg" })}>
                    Start building <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    to="/login"
                    className={buttonVariants({ size: "lg", variant: "outline" })}
                  >
                    Sign in
                  </Link>
                </>
              )}
            </m.div>

            <m.div
              {...enter(0.34)}
              className="mt-16 grid gap-4 md:grid-cols-2"
            >
              <CodeCard />
              <LiveChartCard />
            </m.div>
          </div>
        </section>

        {/* Stats */}
        <section className="border-y border-border bg-card/40">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-6 py-10 md:grid-cols-4">
            {STATS.map(([value, label]) => (
              <div key={label} className="px-4 text-center">
                <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">
                  {value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-center text-3xl font-semibold tracking-tight">
            Everything between{" "}
            <span className="font-mono text-primary">connect()</span> and 3 a.m.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-muted-foreground">
            The realtime plumbing and the observability to trust it — without
            stitching together three vendors.
          </p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
              >
                <f.icon className="h-5 w-5 text-primary" />
                <h3 className="mt-3 text-sm font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="relative overflow-hidden border-t border-border">
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-40 left-1/2 h-[360px] w-[640px] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]"
          />
          <div className="relative mx-auto max-w-6xl px-6 py-20 text-center">
            <h2 className="text-3xl font-semibold tracking-tight">
              Your first message is a minute away.
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
              Sign up, grab your keys, and watch your sockets light up the
              dashboard.
            </p>
            <Link
              to={user ? "/overview" : "/signup"}
              className={cn(buttonVariants({ size: "lg" }), "mt-8")}
            >
              {user ? "Open dashboard" : "Start building"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
            <div className="flex items-center gap-3">
              <Logo />
              <span className="text-xs text-muted-foreground">
                — socket, reversed.
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              © 2026 ketsoc. Built on the edge.
            </p>
          </div>
        </footer>
      </div>
    </LazyMotion>
  );
}
