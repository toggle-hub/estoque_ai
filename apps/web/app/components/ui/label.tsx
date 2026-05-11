import type { ComponentProps } from "react";
import { cn } from "../../lib/utils";

type LabelProps = ComponentProps<"label"> & {
  htmlFor: string;
};

/**
 * Renders a shared form label.
 *
 * @param props Native label props.
 * @returns Styled label.
 */
export function Label({ className, htmlFor, ...props }: LabelProps) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: Shared label requires htmlFor and is paired with controls by callers.
    <label
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700",
        className,
      )}
      htmlFor={htmlFor}
      {...props}
    />
  );
}
