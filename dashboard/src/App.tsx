export default function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <div className="inline-flex items-center gap-3">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary shadow-[0_0_20px_var(--color-primary)]" />
          <h1 className="font-mono text-5xl font-semibold tracking-tight">
            ket<span className="text-primary">soc</span>
          </h1>
        </div>
        <p className="mt-4 text-muted-foreground">
          Globally-distributed sockets. Observability that screams.
        </p>
        <p className="mt-10 font-mono text-xs text-muted-foreground">
          dashboard scaffold · dark-violet theme online
        </p>
      </div>
    </main>
  );
}
