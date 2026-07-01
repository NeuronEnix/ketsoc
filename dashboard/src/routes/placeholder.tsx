export function Placeholder({ title, note }: { title: string; note?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">
        {note ?? "Coming soon — wiring this up next."}
      </p>
    </div>
  );
}
