import { Hexagon } from "lucide-react";
import type * as React from "react";
import { cn } from "../../lib/utils";

/**
 * Renders an animated loading indicator.
 */
export function Spinner({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn("inline-grid size-6 place-items-center text-[#006ec4]", className)}
      {...props}
    >
      <span className="grid size-full animate-spin place-items-center [animation-duration:1.1s]">
        <Hexagon
          aria-hidden="true"
          className="size-full animate-[spinner-bob_900ms_ease-in-out_infinite]"
          strokeWidth={2.25}
        />
      </span>
    </span>
  );
}
