import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const widths = { reading: "max-w-reading", content: "max-w-content", wide: "max-w-wide" };
export type ContainerProps = ComponentProps<"div"> & { width?: keyof typeof widths };

export function Container({ className, width = "content", ...props }: ContainerProps) {
  return <div className={cn("mx-auto w-full px-gutter", widths[width], className)} {...props} />;
}
