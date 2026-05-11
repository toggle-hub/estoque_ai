import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

/**
 * Renders a shared form field layout.
 *
 * @param props Native div props.
 * @returns Field container.
 */
export function Field({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("flex min-w-0 flex-col gap-1.5", className)} {...props} />;
}
