import type * as React from "react";
import { cn } from "../../lib/utils";

/**
 * Renders a shadcn-style card root.
 *
 * @param props Card element props.
 * @returns Styled card element.
 */
export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "rounded-md border border-purple-100 bg-white text-[#16151c] shadow-sm",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Renders card header content.
 *
 * @param props Header element props.
 * @returns Styled card header.
 */
export function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("p-5 pb-3", className)} {...props} />;
}

/**
 * Renders a card title.
 *
 * @param props Heading element props.
 * @returns Styled card title.
 */
export function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      data-slot="card-title"
      className={cn("m-0 text-lg leading-7 font-semibold tracking-normal", className)}
      {...props}
    />
  );
}

/**
 * Renders a card description.
 *
 * @param props Paragraph element props.
 * @returns Styled card description.
 */
export function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("m-0 text-sm leading-6 text-[#5c6670]", className)}
      {...props}
    />
  );
}

/**
 * Renders card body content.
 *
 * @param props Body element props.
 * @returns Styled card content.
 */
export function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("p-5 pt-0", className)} {...props} />;
}
