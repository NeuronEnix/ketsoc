import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary/15 text-violet-bright",
        secondary: "border-border bg-secondary text-secondary-foreground",
        success:
          "border-transparent bg-[color-mix(in_oklab,var(--color-success)_18%,transparent)] text-success",
        warning:
          "border-transparent bg-[color-mix(in_oklab,var(--color-warning)_18%,transparent)] text-warning",
        destructive:
          "border-transparent bg-[color-mix(in_oklab,var(--color-destructive)_18%,transparent)] text-destructive",
        outline: "border-border text-muted-foreground",
        test: "border-warning/40 bg-[color-mix(in_oklab,var(--color-warning)_14%,transparent)] font-mono uppercase tracking-wider text-warning",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export type BadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { badgeVariants };
