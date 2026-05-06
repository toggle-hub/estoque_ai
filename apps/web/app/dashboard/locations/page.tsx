"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { LocationsManagementView, type LocationInventorySummary } from "../../components/locations/locations-management-view";
import { Navbar } from "../../components/navbar";
import {
  createOrganizationLocation,
  getOrganizationLocations,
  getOrganizations,
  getOrganizationStock,
  type Location,
  type Organization,
  type OrganizationStockLevel,
} from "../../lib/api";
import {
  clearSelectedLocation,
  getSelectedLocation,
  getSelectedOrganizationId,
  setSelectedLocation,
  type SelectedLocation,
} from "../../lib/organization-selection";

/**
 * Returns the currently selected organization membership.
 *
 * @returns Selected organization when available.
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
 * Builds location-level inventory summaries from organization stock rows.
 *
 * @param stock Organization stock rows.
 * @returns Inventory summary keyed by location id.
 */
const getLocationSummaries = (stock: OrganizationStockLevel[]) =>
  stock.reduce<Record<string, LocationInventorySummary>>((summaries, stockLevel) => {
    const current = summaries[stockLevel.location_id] ?? {
      itemCount: 0,
      lowStockCount: 0,
      totalQuantity: 0,
      totalValue: 0,
    };
    const unitPrice = Number(stockLevel.item.unit_price ?? 0);

    summaries[stockLevel.location_id] = {
      itemCount: current.itemCount + 1,
      lowStockCount:
        current.lowStockCount + (stockLevel.quantity <= stockLevel.item.reorder_point ? 1 : 0),
      totalQuantity: current.totalQuantity + stockLevel.quantity,
      totalValue: current.totalValue + stockLevel.quantity * unitPrice,
    };

    return summaries;
  }, {});

/**
 * Returns selectable active locations.
 *
 * @param locations Organization locations.
 * @returns Active location rows.
 */
const getActiveLocations = (locations: Location[]) =>
  locations.filter((location) => location.is_active !== false);

/**
 * Renders the selected organization's locations management page.
 *
 * @returns Locations page.
 */
export default function LocationsPage() {
  const queryClient = useQueryClient();
  const { organizationsQuery, selectedOrganization } = useSelectedOrganization();
  const [selectedLocation, setSelectedLocationState] = useState<SelectedLocation | null>(null);
  const organizationId = selectedOrganization?.id;
  const locationsQuery = useQuery({
    enabled: Boolean(organizationId),
    queryKey: ["organizations", organizationId, "locations"],
    queryFn: () => getOrganizationLocations(organizationId ?? ""),
    retry: false,
  });
  const stockQuery = useQuery({
    enabled: Boolean(organizationId),
    queryKey: ["organizations", organizationId, "stock"],
    queryFn: () => getOrganizationStock(organizationId ?? ""),
    retry: false,
  });
  const createLocationMutation = useMutation({
    mutationFn: (input: { address?: string; name: string; organization: Organization }) =>
      createOrganizationLocation({
        address: input.address,
        name: input.name,
        organizationId: input.organization.id,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "locations"] });
    },
  });
  const summaries = useMemo(
    () => getLocationSummaries(stockQuery.data ?? []),
    [stockQuery.data],
  );
  const errorMessage =
    organizationsQuery.error?.message ?? locationsQuery.error?.message ?? stockQuery.error?.message;

  useEffect(() => {
    if (!organizationId || !locationsQuery.data) {
      return;
    }

    const activeLocations = getActiveLocations(locationsQuery.data);
    const storedLocation = getSelectedLocation(organizationId);
    const storedActiveLocation = activeLocations.find((location) => location.id === storedLocation?.id);

    if (storedActiveLocation) {
      setSelectedLocationState({ id: storedActiveLocation.id, name: storedActiveLocation.name });
      return;
    }

    if (activeLocations.length === 1 && activeLocations[0]) {
      const nextLocation = { id: activeLocations[0].id, name: activeLocations[0].name };

      setSelectedLocation(organizationId, nextLocation);
      setSelectedLocationState(nextLocation);
      return;
    }

    clearSelectedLocation(organizationId);
    setSelectedLocationState(null);
  }, [locationsQuery.data, organizationId]);

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      <Navbar
        hasLocationLoadError={Boolean(locationsQuery.error)}
        isLoadingLocations={locationsQuery.isPending}
        locations={locationsQuery.data ?? []}
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
        <LocationsManagementView
          createErrorMessage={createLocationMutation.error?.message}
          errorMessage={errorMessage}
          isCreating={createLocationMutation.isPending}
          isLoading={organizationsQuery.isPending || locationsQuery.isPending}
          locations={locationsQuery.data ?? []}
          onCreate={
            selectedOrganization
              ? (input) =>
                  createLocationMutation.mutate({ ...input, organization: selectedOrganization })
              : undefined
          }
          onRetry={() => {
            organizationsQuery.refetch();
            locationsQuery.refetch();
            stockQuery.refetch();
          }}
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
          summaries={summaries}
        />
      </div>
    </div>
  );
}
