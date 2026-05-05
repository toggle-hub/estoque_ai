import type * as React from "react";
import { cn } from "../../lib/utils";

type BadgeProps = React.ComponentProps<"span"> & {
  variant?: "default" | "secondary" | "outline";
};

const variants = {
  default: "bg-purple-500 text-white",
  secondary: "bg-purple-100 text-purple-900",
  outline: "border border-purple-200 bg-white text-purple-900",
};

/**
 * Renders a shadcn-style badge primitive.
 *
 * @param props Badge props and style options.
 * @returns Styled badge element.
 */
export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex min-h-6 items-center rounded-md px-2 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
