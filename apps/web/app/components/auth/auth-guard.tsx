"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { ApiError, getCurrentUser } from "../../lib/api";

type AuthGuardProps = {
  children: ReactNode;
};

/**
 * Renders children only after the current session is confirmed.
 *
 * @param props Guard props.
 * @returns Protected content or a loading state.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const authQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentUser,
    retry: false,
  });
  const isUnauthorized = authQuery.error instanceof ApiError && authQuery.error.status === 401;

  useEffect(() => {
    if (!isUnauthorized) {
      return;
    }

    const search = window.location.search.replace(/^\?/, "");
    const fullPath = search ? `${pathname}?${search}` : pathname;
    const nextPath = encodeURIComponent(fullPath);
    router.replace(`/auth/login?next=${nextPath}`);
  }, [isUnauthorized, pathname, router]);

  if (authQuery.isPending || isUnauthorized) {
    return (
      <main className="grid min-h-svh place-items-center bg-white text-sm text-[#667085]">
        Loading...
      </main>
    );
  }

  if (authQuery.error) {
    return (
      <main className="grid min-h-svh place-items-center bg-white text-sm text-[#b42318]">
        Unable to verify your session.
      </main>
    );
  }

  return children;
}
