"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { LocationInventoryView } from "../../../../components/inventory/location-inventory-view";
import { Navbar } from "../../../../components/navbar";
import {
  createLocationItem,
  getLocationItems,
  getOrganizationCategories,
  getOrganizationLocations,
  getOrganizations,
  type Location,
  type LocationItemInput,
} from "../../../../lib/api";
import {
  clearSelectedLocation,
  getSelectedLocation,
  getSelectedOrganizationId,
  setSelectedLocation,
  type SelectedLocation,
} from "../../../../lib/organization-selection";

/**
 * Returns the first route param value when Next provides an array.
 *
 * @param value Route param value.
 * @returns Single route param value.
 */
const getRouteParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

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
 * Renders inventory for one selected location.
 *
 * @returns Location inventory page.
 */
export default function LocationInventoryPage() {
  const params = useParams();
  const routeLocationId = getRouteParam(params.locationId);
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
        throw new Error("Organization is required to load locations.");
      }

      return getOrganizationLocations(organizationId);
    },
    retry: false,
  });
  const activeLocations = useMemo(
    () => getActiveLocations(locationsQuery.data ?? []),
    [locationsQuery.data],
  );
  const location = activeLocations.find((activeLocation) => activeLocation.id === routeLocationId);
  const locationId = location?.id;
  const itemsQuery = useQuery({
    enabled: Boolean(locationId),
    queryKey: ["locations", locationId, "items"],
    queryFn: () => {
      if (!locationId) {
        throw new Error("Location is required to load items.");
      }

      return getLocationItems(locationId);
    },
    retry: false,
  });
  const categoriesQuery = useQuery({
    enabled: Boolean(organizationId),
    queryKey: ["organizations", organizationId, "categories"],
    queryFn: () => {
      if (!organizationId) {
        throw new Error("Organization is required to load categories.");
      }

      return getOrganizationCategories(organizationId);
    },
    retry: false,
  });
  const createItemMutation = useMutation({
    mutationFn: (input: LocationItemInput & { locationId: string }) =>
      createLocationItem(input.locationId, {
        category_id: input.category_id,
        description: input.description,
        name: input.name,
        quantity: input.quantity,
        reorder_point: input.reorder_point,
        sku: input.sku,
        unit_price: input.unit_price,
      }),
    onSuccess: async (_item, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["locations", variables.locationId, "items"] }),
        organizationId
          ? queryClient.invalidateQueries({ queryKey: ["organizations", organizationId, "stock"] })
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
    (locationId ? itemsQuery.error?.message : undefined) ??
    (hasOrganization ? categoriesQuery.error?.message : undefined);

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

    if (location) {
      const nextLocation = { id: location.id, name: location.name };

      setSelectedLocation(organizationId, nextLocation);
      setSelectedLocationState(nextLocation);
      return;
    }

    const storedLocation = getSelectedLocation(organizationId);
    const storedActiveLocation = activeLocations.find(
      (activeLocation) => activeLocation.id === storedLocation?.id,
    );

    if (storedActiveLocation) {
      setSelectedLocationState({ id: storedActiveLocation.id, name: storedActiveLocation.name });
      return;
    }

    clearSelectedLocation(organizationId);
    setSelectedLocationState(null);
  }, [activeLocations, location, locationsQuery.data, organizationId]);

  return (
    <div className="min-h-screen bg-white md:flex">
      <Navbar
        hasLocationLoadError={hasLocationLoadError}
        isLoadingLocations={isLoadingLocations}
        locations={activeLocations}
        onSelectLocation={(nextLocation) => {
          if (!organizationId) {
            return;
          }

          const selection = { id: nextLocation.id, name: nextLocation.name };

          setSelectedLocation(organizationId, selection);
          setSelectedLocationState(selection);
        }}
        organization={selectedOrganization}
        selectedLocationId={selectedLocation?.id}
        selectedLocationName={selectedLocation?.name}
      />

      <div className="min-w-0 flex-1 pt-16 md:pt-0">
        <LocationInventoryView
          categories={categoriesQuery.data ?? []}
          createErrorMessage={createItemMutation.error?.message}
          errorMessage={errorMessage}
          isCreating={createItemMutation.isPending}
          isLoading={
            organizationsQuery.isPending ||
            (hasOrganization ? locationsQuery.isPending : false) ||
            (locationId ? itemsQuery.isPending : false)
          }
          items={itemsQuery.data ?? []}
          location={location}
          onCreate={
            locationId
              ? async (input) => {
                  await createItemMutation.mutateAsync({
                    ...input,
                    locationId,
                  });
                }
              : undefined
          }
          onRetry={() => {
            organizationsQuery.refetch();

            if (organizationId) {
              locationsQuery.refetch();
              categoriesQuery.refetch();
            }

            if (locationId) {
              itemsQuery.refetch();
            }
          }}
          organization={selectedOrganization}
        />
      </div>
    </div>
  );
}
