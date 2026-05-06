"use client";

import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { getOrganizations } from "../../lib/api";
import {
  clearSelectedOrganizationId,
  getSelectedOrganizationId,
  setSelectedOrganizationId,
} from "../../lib/organization-selection";
import { Spinner } from "../ui/spinner";

type OrganizationGuardProps = {
  children: ReactNode;
};

/**
 * Requires dashboard routes to have an explicit selected organization.
 *
 * @param props Guard props.
 * @returns Protected content or organization loading/redirect state.
 */
export function OrganizationGuard({ children }: OrganizationGuardProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [selectedOrganizationId, setSelectedOrganizationIdState] = useState<string | null>(null);
  const [hasLoadedSelection, setHasLoadedSelection] = useState(false);
  const organizationsQuery = useQuery({
    queryKey: ["organizations"],
    queryFn: getOrganizations,
    retry: false,
  });

  useEffect(() => {
    setSelectedOrganizationIdState(getSelectedOrganizationId());
    setHasLoadedSelection(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedSelection || !organizationsQuery.data) {
      return;
    }

    if (!organizationsQuery.data.length) {
      router.replace("/organizations/select");
      return;
    }

    if (organizationsQuery.data.length === 1) {
      const organizationId = organizationsQuery.data[0]?.id;

      if (organizationId) {
        setSelectedOrganizationId(organizationId);
        setSelectedOrganizationIdState(organizationId);
      }
      return;
    }

    const selectedOrganization = organizationsQuery.data.find(
      (organization) => organization.id === selectedOrganizationId,
    );

    if (selectedOrganization) {
      return;
    }

    clearSelectedOrganizationId();
    router.replace(`/organizations/select?next=${encodeURIComponent(pathname)}`);
  }, [hasLoadedSelection, organizationsQuery.data, pathname, router, selectedOrganizationId]);

  if (!hasLoadedSelection || organizationsQuery.isPending) {
    return (
      <main className="grid min-h-svh place-items-center bg-white">
        <Spinner />
      </main>
    );
  }

  if (organizationsQuery.error) {
    return (
      <main className="grid min-h-svh place-items-center bg-white text-sm text-[#b42318]">
        Unable to load organization context.
      </main>
    );
  }

  if (!organizationsQuery.data.length) {
    return (
      <main className="grid min-h-svh place-items-center bg-white">
        <Spinner />
      </main>
    );
  }

  if (!selectedOrganizationId) {
    return (
      <main className="grid min-h-svh place-items-center bg-white">
        <Spinner />
      </main>
    );
  }

  return children;
}
