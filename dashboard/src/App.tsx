import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import { MetricReadout } from "@/components/metric-readout";

export default function App() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <header className="mb-10 flex items-center gap-3">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-primary shadow-[0_0_20px_var(--color-primary)]" />
          <h1 className="font-mono text-2xl font-semibold tracking-tight">
            ket<span className="text-primary">soc</span>
          </h1>
          <Badge variant="outline" className="ml-1">
            design system
          </Badge>
          <Badge variant="test" className="ml-auto">
            test mode
          </Badge>
        </header>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Live metrics</CardTitle>
            <CardDescription>
              Mono, tabular figures — the detail developers feel in their teeth.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <MetricReadout label="Connections" value="12,480" delta={4} />
            <MetricReadout label="Msgs / sec" value="8,214" delta={12} />
            <MetricReadout label="p99.9 (tail)" value="42" unit="ms" delta={-6} />
            <MetricReadout label="RTT" value="28" unit="ms" delta={-2} />
          </CardContent>
        </Card>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Buttons</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button size="sm">Small</Button>
            <span className="ml-2 flex items-center gap-1 text-sm text-muted-foreground">
              Command palette <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </CardContent>
        </Card>

        <div className="grid gap-8 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Sign in</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@company.com" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" placeholder="••••••••" />
              </div>
              <Button className="mt-1">Continue</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Badges &amp; status</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Badge>default</Badge>
              <Badge variant="secondary">secondary</Badge>
              <Badge variant="success">healthy</Badge>
              <Badge variant="warning">degraded</Badge>
              <Badge variant="destructive">error</Badge>
              <Badge variant="outline">prod</Badge>
              <Badge variant="test">test mode</Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
