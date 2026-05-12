import type * as React from "react";
import { cn } from "../../lib/utils";

/**
 * Renders a shadcn-style table element.
 *
 * @param props Table element props.
 * @returns Styled table element.
 */
export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <table
      data-slot="table"
      className={cn("w-full border-collapse text-left text-sm", className)}
      {...props}
    />
  );
}

/**
 * Renders an accessible table caption.
 *
 * @param props Caption element props.
 * @returns Styled caption element.
 */
export function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return <caption data-slot="table-caption" className={cn("sr-only", className)} {...props} />;
}

/**
 * Renders a table header group.
 *
 * @param props Table head element props.
 * @returns Styled table header group.
 */
export function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("bg-purple-50 text-xs font-semibold text-purple-700", className)}
      {...props}
    />
  );
}

/**
 * Renders a table body group.
 *
 * @param props Table body element props.
 * @returns Styled table body group.
 */
export function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={className} {...props} />;
}

/**
 * Renders a table footer group.
 *
 * @param props Table footer element props.
 * @returns Styled table footer group.
 */
export function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("border-t border-purple-100 bg-purple-50 font-medium", className)}
      {...props}
    />
  );
}

/**
 * Renders a table row.
 *
 * @param props Table row element props.
 * @returns Styled table row.
 */
export function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return <tr data-slot="table-row" className={cn("border-t border-purple-100", className)} {...props} />;
}

/**
 * Renders a table column header cell.
 *
 * @param props Table header cell props.
 * @returns Styled table header cell.
 */
export function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return <th data-slot="table-head" className={cn("px-3 py-3", className)} {...props} />;
}

/**
 * Renders a table body cell.
 *
 * @param props Table cell props.
 * @returns Styled table body cell.
 */
export function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return <td data-slot="table-cell" className={cn("px-3 py-3", className)} {...props} />;
}
