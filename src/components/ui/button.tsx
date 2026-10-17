import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const variants = {
  primary: "border-transparent bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "border-border bg-surface text-foreground hover:bg-surface-muted",
  ghost: "border-transparent bg-transparent text-foreground hover:bg-surface-muted",
};
const sizes = {
  sm: "min-h-11 px-4 py-2 text-sm",
  md: "min-h-12 px-5 py-3 text-sm",
  lg: "min-h-14 px-7 py-3.5 text-base",
};
export type ButtonProps = ComponentProps<"button"> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export function Button({ className, variant = "primary", size = "md", type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-control border font-medium leading-snug transition-colors duration-200 ease-gentle disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
        variants[variant], sizes[size], className,
      )}
      {...props}
    />
  );
}
