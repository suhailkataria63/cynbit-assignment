import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function ActionLink({ className, variant = "primary", ...props }: ComponentProps<typeof Link> & { variant?: "primary" | "secondary" }) {
  return <Link className={cn("inline-flex min-h-12 items-center justify-center gap-2 rounded-control border px-5 py-3 text-sm font-medium transition-colors duration-200", variant === "primary" ? "border-accent bg-accent text-on-accent hover:bg-accent-hover" : "border-border bg-surface text-foreground hover:bg-surface-muted", className)} {...props} />;
}
