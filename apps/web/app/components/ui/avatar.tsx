"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import type * as React from "react";
import { cn } from "../../lib/utils";

/**
 * Renders the shadcn avatar root.
 */
export const Avatar = ({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) => (
  <AvatarPrimitive.Root
    data-slot="avatar"
    className={cn("relative flex size-10 shrink-0 overflow-hidden rounded-full", className)}
    {...props}
  />
);

/**
 * Renders the avatar image.
 */
export const AvatarImage = ({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) => (
  <AvatarPrimitive.Image
    data-slot="avatar-image"
    className={cn("aspect-square size-full", className)}
    {...props}
  />
);

/**
 * Renders fallback content when the avatar image is unavailable.
 */
export const AvatarFallback = ({
  className,
  ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) => (
  <AvatarPrimitive.Fallback
    data-slot="avatar-fallback"
    className={cn("flex size-full items-center justify-center rounded-full bg-gray-100", className)}
    {...props}
  />
);
