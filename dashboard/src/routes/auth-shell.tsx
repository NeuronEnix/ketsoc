import type { ReactNode } from "react";

/** Centered layout for the unauthenticated auth screens. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_20px_var(--color-primary)]" />
          <span className="font-mono text-xl font-semibold tracking-tight">
            ket<span className="text-primary">soc</span>
          </span>
        </div>
        {children}
      </div>
    </main>
  );
}
