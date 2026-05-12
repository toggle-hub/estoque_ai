"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "sonner";
import { AuthGuard } from "../../components/auth/auth-guard";
import { OrganizationSelectionView } from "../../components/organizations/organization-selection-view";
import { createOrganization, getOrganizations } from "../../lib/api";
import {
  getSelectedOrganizationId,
  setSelectedOrganizationId,
} from "../../lib/organization-selection";

/**
 * Returns a safe in-app redirect target.
 *
 * @param value Potential redirect target from query string.
 * @returns Safe redirect path.
 */
const getSafeNextPath = (value: string | null) =>
  value?.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";

/**
 * Renders the authenticated organization selection route.
 *
 * @returns Organization selection route.
 */
export default function OrganizationSelectionRoute() {
  return (
    <AuthGuard>
      <Suspense
        fallback={
          <OrganizationSelectionView
            isLoading
            organizations={[]}
            selectedOrganizationId={null}
          />
        }
      >
        <OrganizationSelectionPage />
      </Suspense>
    </AuthGuard>
  );
}

/**
 * Loads organization memberships and persists the selected organization.
 *
 * @returns Organization selection page content.
 */
function OrganizationSelectionPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const nextPath = getSafeNextPath(searchParams.get("next"));
  const isSwitchMode = searchParams.get("mode") === "switch";
  const [selectedOrganizationId, setSelectedOrganizationIdState] = useState<
    string | null
  >(null);
  const organizationsQuery = useQuery({
    queryKey: ["organizations"],
    queryFn: getOrganizations,
    retry: false,
  });
  const createOrganizationMutation = useMutation({
    mutationFn: createOrganization,
    onSuccess: async (organization) => {
      toast.success("Organização criada.");
      setSelectedOrganizationId(organization.id);
      setSelectedOrganizationIdState(organization.id);
      await queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    setSelectedOrganizationIdState(getSelectedOrganizationId());
  }, []);

  useEffect(() => {
    if (isSwitchMode || organizationsQuery.data?.length !== 1) {
      return;
    }

    const organizationId = organizationsQuery.data[0]?.id;

    if (!organizationId) {
      return;
    }

    setSelectedOrganizationId(organizationId);
    setSelectedOrganizationIdState(organizationId);
    router.replace(nextPath);
  }, [isSwitchMode, nextPath, organizationsQuery.data, router]);

  return (
    <OrganizationSelectionView
      errorMessage={organizationsQuery.error?.message}
      isLoading={organizationsQuery.isPending}
      isCreating={createOrganizationMutation.isPending}
      onCreate={async (input) => {
        await createOrganizationMutation.mutateAsync(input);
      }}
      onRetry={() => organizationsQuery.refetch()}
      onSelect={(organizationId) => {
        setSelectedOrganizationId(organizationId);
        setSelectedOrganizationIdState(organizationId);
        router.replace(nextPath);
      }}
      organizations={organizationsQuery.data ?? []}
      selectedOrganizationId={selectedOrganizationId}
    />
  );
}
