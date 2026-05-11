import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

/**
 * Renders a shared form label.
 *
 * @param props Native label props.
 * @returns Styled label.
 */
export function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700",
        className,
      )}
      {...props}
    />
  );
}
