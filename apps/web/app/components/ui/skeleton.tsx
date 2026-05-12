import type * as React from "react";
import { cn } from "../../lib/utils";

/**
 * Renders a shadcn-style skeleton placeholder.
 *
 * @param props Skeleton element props.
 * @returns Styled skeleton placeholder.
 */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-purple-100", className)}
      {...props}
    />
  );
}
