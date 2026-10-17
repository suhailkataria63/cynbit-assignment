import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const spacing = { default: "py-section", compact: "py-section-compact", none: "py-0" };
export type SectionProps = ComponentProps<"section"> & { spacing?: keyof typeof spacing };

export function Section({ className, spacing: density = "default", ...props }: SectionProps) {
  return <section className={cn(spacing[density], className)} {...props} />;
}
