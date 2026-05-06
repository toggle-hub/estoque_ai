import type * as React from "react";
import { cn } from "../../lib/utils";

type AlertProps = React.ComponentProps<"div"> & {
  variant?: "default" | "destructive";
};

const variants = {
  default: "border-purple-100 bg-white text-[#16151c]",
  destructive: "border-[#f3b8b0] bg-white text-[#b42318]",
};

/**
 * Renders a shadcn-style alert root.
 *
 * @param props Alert props and style options.
 * @returns Styled alert element.
 */
export function Alert({ className, variant = "default", ...props }: AlertProps) {
  return (
    <div
      data-slot="alert"
      className={cn("relative rounded-md border p-4", variants[variant], className)}
      {...props}
    />
  );
}

/**
 * Renders an alert title.
 *
 * @param props Heading element props.
 * @returns Styled alert title.
 */
export function AlertTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="alert-title"
      className={cn("m-0 mb-1 text-sm font-medium tracking-normal", className)}
      {...props}
    />
  );
}

/**
 * Renders alert body copy.
 *
 * @param props Paragraph element props.
 * @returns Styled alert description.
 */
export function AlertDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="alert-description"
      className={cn("m-0 text-sm leading-6 text-current", className)}
      {...props}
    />
  );
}
