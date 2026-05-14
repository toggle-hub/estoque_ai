"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Navbar } from "../../../components/navbar";
import { OrganizationSettingsView } from "../../../components/organizations/organization-settings-view";
import {
  getOrganization,
  getOrganizationLocations,
  getOrganizations,
  type Location,
  type Organization,
  type OrganizationProfileInput,
  updateOrganization,
} from "../../../lib/api";
import {
  clearSelectedLocation,
  getSelectedLocation,
  getSelectedOrganizationId,
  type SelectedLocation,
  setSelectedLocation,
} from "../../../lib/organization-selection";

/**
 * Returns the currently selected organization membership.
 *
 * @returns Selected organization and its backing query.
 */
const useSelectedOrganization = () => {
  const organizationsQuery = useQuery({
    queryKey: ["organizations"],
    queryFn: getOrganizations,
    retry: false,
  });
  const selectedOrganizationId = getSelectedOrganizationId();
  const selectedOrganization = organizationsQuery.data?.find(
    (organization) => organization.id === selectedOrganizationId,
  );

  return {
    organizationsQuery,
    selectedOrganization,
  };
};

/**
 * Returns selectable active locations.
 *
 * @param locations Organization locations.
 * @returns Active location rows.
 */
const getActiveLocations = (locations: Location[]) =>
  locations.filter((location) => location.is_active !== false);

/**
 * Renders organization settings for the selected dashboard organization.
 *
 * @returns Organization settings page.
 */
export default function OrganizationSettingsPage() {
  const queryClient = useQueryClient();
  const { organizationsQuery, selectedOrganization } =
    useSelectedOrganization();
  const organizationId = selectedOrganization?.id;
  const prevOrganizationId = useRef<string | undefined>(organizationId);
  const [selectedLocation, setSelectedLocationState] =
    useState<SelectedLocation | null>(null);
  const organizationQuery = useQuery({
    enabled: Boolean(organizationId),
    queryKey: ["organizations", organizationId],
    queryFn: () => getOrganization(organizationId ?? ""),
    retry: false,
  });
  const locationsQuery = useQuery({
    enabled: Boolean(organizationId),
    queryKey: ["organizations", organizationId, "locations"],
    queryFn: () => getOrganizationLocations(organizationId ?? ""),
    retry: false,
  });
  const updateOrganizationMutation = useMutation({
    mutationFn: (input: {
      organization: Organization;
      profile: OrganizationProfileInput;
    }) => updateOrganization(input.organization.id, input.profile),
    onSuccess: async (_organization, variables) => {
      toast.success("Perfil da organização salvo.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["organizations"] }),
        queryClient.invalidateQueries({
          queryKey: ["organizations", variables.organization.id],
        }),
      ]);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  const hasOrganization = Boolean(organizationId);
  const isLoadingLocations = hasOrganization ? locationsQuery.isPending : false;
  const hasLocationLoadError = hasOrganization
    ? Boolean(locationsQuery.error)
    : false;
  const activeLocations = useMemo(
    () => getActiveLocations(locationsQuery.data ?? []),
    [locationsQuery.data],
  );
  const organization = organizationQuery.data ?? selectedOrganization;
  const errorMessage =
    organizationsQuery.error?.message ??
    (hasOrganization ? organizationQuery.error?.message : undefined);

  useEffect(() => {
    if (prevOrganizationId.current === organizationId) {
      return;
    }

    setSelectedLocationState(null);
    prevOrganizationId.current = organizationId;
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId || !locationsQuery.data) {
      return;
    }

    const storedLocation = getSelectedLocation(organizationId);
    const storedActiveLocation = activeLocations.find(
      (location) => location.id === storedLocation?.id,
    );

    if (storedActiveLocation) {
      setSelectedLocationState({
        id: storedActiveLocation.id,
        name: storedActiveLocation.name,
      });
      return;
    }

    if (activeLocations.length === 1 && activeLocations[0]) {
      const nextLocation = {
        id: activeLocations[0].id,
        name: activeLocations[0].name,
      };

      setSelectedLocation(organizationId, nextLocation);
      setSelectedLocationState(nextLocation);
      return;
    }

    clearSelectedLocation(organizationId);
    setSelectedLocationState(null);
  }, [activeLocations, locationsQuery.data, organizationId]);

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      <Navbar
        hasLocationLoadError={hasLocationLoadError}
        isLoadingLocations={isLoadingLocations}
        locations={activeLocations}
        onSelectLocation={(location) => {
          if (!organizationId) {
            return;
          }

          const nextLocation = { id: location.id, name: location.name };

          setSelectedLocation(organizationId, nextLocation);
          setSelectedLocationState(nextLocation);
        }}
        organization={organization}
        selectedLocationId={selectedLocation?.id}
        selectedLocationName={selectedLocation?.name}
      />

      <div className="min-w-0 flex-1 pt-16 md:pt-0">
        <OrganizationSettingsView
          errorMessage={errorMessage}
          isLoading={
            organizationsQuery.isPending ||
            (hasOrganization ? organizationQuery.isPending : false)
          }
          isSaving={updateOrganizationMutation.isPending}
          onRetry={() => {
            organizationsQuery.refetch();
            organizationQuery.refetch();
            locationsQuery.refetch();
          }}
          onSave={
            organization
              ? async (profile) => {
                  await updateOrganizationMutation.mutateAsync({
                    organization,
                    profile,
                  });
                }
              : undefined
          }
          organization={organization}
        />
      </div>
    </div>
  );
}
