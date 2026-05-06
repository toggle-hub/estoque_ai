"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { LocationsManagementView, type LocationInventorySummary } from "../../components/locations/locations-management-view";
import {
  createOrganizationLocation,
  getOrganizationLocations,
  getOrganizations,
  getOrganizationStock,
  type Organization,
  type OrganizationStockLevel,
} from "../../lib/api";
import { getSelectedOrganizationId } from "../../lib/organization-selection";

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
 * Renders the selected organization's locations management page.
 *
 * @returns Locations page.
 */
export default function LocationsPage() {
  const queryClient = useQueryClient();
  const { organizationsQuery, selectedOrganization } = useSelectedOrganization();
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

  return (
    <LocationsManagementView
      createErrorMessage={createLocationMutation.error?.message}
      errorMessage={errorMessage}
      isCreating={createLocationMutation.isPending}
      isLoading={organizationsQuery.isPending || locationsQuery.isPending}
      locations={locationsQuery.data ?? []}
      onCreate={
        selectedOrganization
          ? (input) => createLocationMutation.mutate({ ...input, organization: selectedOrganization })
          : undefined
      }
      onRetry={() => {
        organizationsQuery.refetch();
        locationsQuery.refetch();
        stockQuery.refetch();
      }}
      organization={selectedOrganization}
      summaries={summaries}
    />
  );
}
