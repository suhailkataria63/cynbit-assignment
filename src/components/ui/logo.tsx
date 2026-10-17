import Link from "next/link";
import { Layers2 } from "lucide-react";
import { cn } from "@/lib/cn";

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="Cynbit home" className={cn("inline-flex items-center gap-2.5 text-xl font-semibold tracking-tight", className)}>
      <span className="grid size-9 place-items-center rounded-xl bg-accent text-on-accent"><Layers2 size={20} strokeWidth={1.7} aria-hidden="true" /></span>
      cynbit<span className="-ml-2 text-accent">.</span>
    </Link>
  );
}
