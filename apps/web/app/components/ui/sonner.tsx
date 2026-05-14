"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Renders the app-wide shadcn-style Sonner toaster.
 *
 * @param props Sonner toaster props.
 * @returns Configured toaster component.
 */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      position="top-right"
      richColors
      toastOptions={{
        classNames: {
          actionButton:
            "group-[.toaster]:bg-purple-600 group-[.toaster]:text-white",
          cancelButton:
            "group-[.toaster]:bg-purple-100 group-[.toaster]:text-purple-700",
          description: "group-[.toast]:text-gray-600",
          toast:
            "group toast group-[.toaster]:rounded-md group-[.toaster]:border group-[.toaster]:border-purple-100 group-[.toaster]:bg-white group-[.toaster]:text-[#16151c] group-[.toaster]:shadow-lg",
        },
      }}
      {...props}
    />
  );
}
