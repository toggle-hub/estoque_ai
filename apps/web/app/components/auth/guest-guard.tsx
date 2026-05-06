"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { getCurrentUser } from "../../lib/api";
import { Spinner } from "../ui/spinner";

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
  const pathname = usePathname();
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

    const next = new URLSearchParams(window.location.search).get("next");
    const currentPath = window.location.pathname
      ? `${window.location.pathname}${window.location.search}${window.location.hash}`
      : pathname;
    const redirectPath = next ?? (pathname === "/auth/login" ? "/dashboard" : currentPath);

    router.replace(`/organizations/select?next=${encodeURIComponent(redirectPath)}`);
  }, [authQuery.data, pathname, router]);

  if (authQuery.isPending || authQuery.data) {
    return (
      <main className="grid min-h-svh place-items-center bg-white">
        <Spinner />
      </main>
    );
  }

  return children;
}
