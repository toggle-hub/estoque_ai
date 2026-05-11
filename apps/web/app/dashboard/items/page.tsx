"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ItemsCatalogView, type CatalogItem } from "../../components/items/items-catalog-view";
import { Navbar } from "../../components/navbar";
import {
  getLocationItems,
  getOrganizationLocations,
  getOrganizations,
  type Location,
  type LocationItem,
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
 * Returns selectable active locations.
 *
 * @param locations Organization locations.
 * @returns Active location rows.
 */
const getActiveLocations = (locations: Location[]) =>
  locations.filter((location) => location.is_active !== false);

/**
 * Loads items for every active location.
 *
 * @param locations Active organization locations.
 * @returns Location item groups.
 */
const getItemsByLocation = async (locations: Location[]): Promise<LocationItemsResult[]> => {
  const itemGroups = await Promise.all(
    locations.map(async (location) => ({
      location,
      items: await getLocationItems(location.id),
    })),
  );

  return itemGroups;
};

/**
 * Aggregates location item rows into one organization-wide catalog.
 *
 * @param itemGroups Location item groups.
 * @returns Catalog rows keyed by item id.
 */
const getCatalogItems = (itemGroups: LocationItemsResult[]): CatalogItem[] => {
  const itemsById = new Map<string, CatalogItem>();

  for (const { items, location } of itemGroups) {
    for (const item of items) {
      const current = itemsById.get(item.id) ?? {
        id: item.id,
        sku: item.sku,
        name: item.name,
        categoryName: item.category?.name ?? null,
        description: item.description,
        unitPrice: item.unit_price,
        reorderPoint: item.reorder_point,
        totalQuantity: 0,
        locations: [],
      };

      current.totalQuantity += item.quantity;
      current.locations.push({
        inventoryHref: `/dashboard/locations/${location.id}/inventory`,
        locationId: location.id,
        locationName: location.name,
        quantity: item.quantity,
      });
      itemsById.set(item.id, current);
    }
  }

  return Array.from(itemsById.values()).sort((first, second) =>
    first.name.localeCompare(second.name),
  );
};

/**
 * Renders the selected organization's global items catalog.
 *
 * @returns Items catalog page.
 */
export default function ItemsPage() {
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
  const activeLocationIds = useMemo(
    () => activeLocations.map((location) => location.id).join(","),
    [activeLocations],
  );
  const catalogQueryKey = [
    "organizations",
    organizationId,
    "items-catalog",
    activeLocationIds,
    activeLocations,
  ] as const;
  const catalogQuery = useQuery({
    enabled: Boolean(organizationId) && Boolean(locationsQuery.data),
    queryKey: catalogQueryKey,
    queryFn: async ({ queryKey }) => {
      const queryActiveLocations = queryKey[4];

      return getCatalogItems(await getItemsByLocation(queryActiveLocations));
    },
    retry: false,
  });
  const hasOrganization = Boolean(organizationId);
  const isLoadingLocations = hasOrganization ? locationsQuery.isPending : false;
  const hasLocationLoadError = hasOrganization ? Boolean(locationsQuery.error) : false;
  const errorMessage =
    organizationsQuery.error?.message ??
    (hasOrganization ? locationsQuery.error?.message : undefined) ??
    (hasOrganization ? catalogQuery.error?.message : undefined);

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
  }, [activeLocations, locationsQuery.data, organizationId]);

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
        <ItemsCatalogView
          errorMessage={errorMessage}
          isLoading={
            organizationsQuery.isPending ||
            (hasOrganization ? locationsQuery.isPending : false) ||
            (hasOrganization ? catalogQuery.isPending : false)
          }
          items={catalogQuery.data ?? []}
          onRetry={() => {
            organizationsQuery.refetch();

            if (organizationId) {
              locationsQuery.refetch();
              catalogQuery.refetch();
            }
          }}
          organization={selectedOrganization}
          selectedLocationId={selectedLocation?.id}
        />
      </div>
    </div>
  );
}
