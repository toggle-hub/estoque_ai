"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { getCurrentUser } from "../../lib/api";

type GuestGuardProps = {
  children: ReactNode;
};

/**
 * Renders children only when no active session is present.
 *
 * @param props Guard props.
 * @returns Guest content or a loading state.
 */
export function GuestGuard({ children }: GuestGuardProps) {
  const router = useRouter();
  const authQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentUser,
    retry: false,
  });

  useEffect(() => {
    if (!authQuery.data) {
      return;
    }

    router.replace("/dashboard");
  }, [authQuery.data, router]);

  if (authQuery.isPending || authQuery.data) {
    return (
      <main className="grid min-h-svh place-items-center bg-white text-sm text-[#667085]">
        Loading...
      </main>
    );
  }

  return children;
}
