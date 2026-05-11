import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

/**
 * Renders a shared native select control.
 *
 * @param props Native select props.
 * @returns Styled select control.
 */
export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-10 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:cursor-not-allowed disabled:bg-purple-50",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Renders a shared native select option.
 *
 * @param props Native option props.
 * @returns Select option.
 */
export function SelectItem(props: ComponentProps<"option">) {
  return <option {...props} />;
}
