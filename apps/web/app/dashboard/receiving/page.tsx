"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Navbar } from "../../components/navbar";
import { ReceivingView } from "../../components/receiving/receiving-view";
import {
  createReceivingTransaction,
  getLocationItems,
  getOrganizationLocations,
  getOrganizations,
  type Location,
  type LocationItem,
  type ReceivingTransactionInput,
} from "../../lib/api";
import {
  clearSelectedLocation,
  getSelectedLocation,
  getSelectedOrganizationId,
  setSelectedLocation,
  type SelectedLocation,
} from "../../lib/organization-selection";

type LocationItemsResult = {
  items: LocationItem[];
  location: Location;
};

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
 * Returns selectable active locations for getActiveLocations.
 *
 * @param locations Location[] rows to filter by the is_active property.
 * @returns Location[] rows where is_active is not strictly false.
 */
const getActiveLocations = (locations: Location[]) =>
  locations.filter((location) => location.is_active !== false);

/**
 * Loads items for every active location.
 *
 * @param locations Active organization locations.
 * @returns Flat location item rows.
 */
const getItemsByLocation = async (locations: Location[]) => {
  const itemGroups: LocationItemsResult[] = await Promise.all(
    locations.map(async (location) => ({
      location,
      items: await getLocationItems(location.id),
    })),
  );

  return itemGroups.flatMap(({ items, location }) =>
    items.map((item) => ({
      ...item,
      location_id: location.id,
    })),
  );
};

/**
 * Renders the receiving workflow for the selected organization.
 *
 * @returns Receiving page.
 */
export default function ReceivingPage() {
  const searchParams = useSearchParams();
  const preselectedLocationId = searchParams.get("locationId");
  const preselectedItemId = searchParams.get("itemId");
  const queryClient = useQueryClient();
  const { organizationsQuery, selectedOrganization } = useSelectedOrganization();
  const organizationId = selectedOrganization?.id;
  const prevOrganizationId = useRef<string | undefined>(organizationId);
  const [selectedLocation, setSelectedLocationState] = useState<SelectedLocation | null>(null);
  const locationsQuery = useQuery({
    enabled: Boolean(organizationId),
    queryKey: ["organizations", organizationId, "locations"],
    queryFn: () => {
      if (!organizationId) {
        throw new Error("A organização é obrigatória para carregar locais.");
      }

      return getOrganizationLocations(organizationId);
    },
    retry: false,
  });
  const activeLocations = useMemo(
    () => getActiveLocations(locationsQuery.data ?? []),
    [locationsQuery.data],
  );
  const itemsQueryKey = ["organizations", organizationId, "receiving-items", activeLocations] as const;
  const itemsQuery = useQuery({
    enabled: Boolean(organizationId) && Boolean(locationsQuery.data),
    queryKey: itemsQueryKey,
    queryFn: ({ queryKey }) => getItemsByLocation(queryKey[3]),
    retry: false,
  });
  const receiveMutation = useMutation({
    mutationFn: (input: ReceivingTransactionInput & { locationId: string }) => {
      const { locationId, ...payload } = input;

      return createReceivingTransaction(locationId, payload);
    },
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["locations", variables.locationId, "items"] }),
        organizationId
          ? queryClient.invalidateQueries({
              queryKey: ["organizations", organizationId, "receiving-items"],
            })
          : Promise.resolve(),
      ]);
    },
  });
  const hasOrganization = Boolean(organizationId);
  const isLoadingLocations = hasOrganization ? locationsQuery.isPending : false;
  const hasLocationLoadError = hasOrganization ? Boolean(locationsQuery.error) : false;
  const errorMessage =
    organizationsQuery.error?.message ??
    (hasOrganization ? locationsQuery.error?.message : undefined) ??
    (hasOrganization ? itemsQuery.error?.message : undefined);

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

    const preselectedLocation = activeLocations.find(
      (location) => location.id === preselectedLocationId,
    );

    if (preselectedLocation) {
      const nextLocation = { id: preselectedLocation.id, name: preselectedLocation.name };

      setSelectedLocation(organizationId, nextLocation);
      setSelectedLocationState(nextLocation);
      return;
    }

    const storedLocation = getSelectedLocation(organizationId);
    const storedActiveLocation = activeLocations.find(
      (location) => location.id === storedLocation?.id,
    );

    if (storedActiveLocation) {
      setSelectedLocationState({ id: storedActiveLocation.id, name: storedActiveLocation.name });
      return;
    }

    clearSelectedLocation(organizationId);
    setSelectedLocationState(null);
  }, [activeLocations, locationsQuery.data, organizationId, preselectedLocationId]);

  return (
    <div className="min-h-screen bg-white md:flex">
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
        organization={selectedOrganization}
        selectedLocationId={selectedLocation?.id}
        selectedLocationName={selectedLocation?.name}
      />

      <div className="min-w-0 flex-1 pt-16 md:pt-0">
        <ReceivingView
          errorMessage={errorMessage}
          isLoading={
            organizationsQuery.isPending ||
            (hasOrganization ? locationsQuery.isPending : false) ||
            (hasOrganization ? itemsQuery.isPending : false)
          }
          isSubmitting={receiveMutation.isPending}
          items={itemsQuery.data ?? []}
          locations={activeLocations}
          onReceive={async (input) => {
            await receiveMutation.mutateAsync(input);
          }}
          onRetry={() => {
            organizationsQuery.refetch();

            if (organizationId) {
              locationsQuery.refetch();
              itemsQuery.refetch();
            }
          }}
          organization={selectedOrganization}
          preselectedItemId={preselectedItemId}
          preselectedLocationId={preselectedLocationId}
          submitErrorMessage={receiveMutation.error?.message}
          successResult={receiveMutation.data ?? null}
        />
      </div>
    </div>
  );
}
