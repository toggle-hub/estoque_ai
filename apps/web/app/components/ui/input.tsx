import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

/**
 * Renders a shared text-like input control.
 *
 * @param props Native input props.
 * @returns Styled input control.
 */
export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-10 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:cursor-not-allowed disabled:bg-purple-50",
        className,
      )}
      {...props}
    />
  );
}
