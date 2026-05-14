"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CategoriesManagementView } from "../../components/categories/categories-management-view";
import { Navbar } from "../../components/navbar";
import {
  createOrganizationCategory,
  getOrganizationCategories,
  getOrganizationLocations,
  getOrganizations,
  type CategoryInput,
  type Location,
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
 * Renders the selected organization's categories management page.
 *
 * @returns Categories page.
 */
export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const { organizationsQuery, selectedOrganization } =
    useSelectedOrganization();
  const organizationId = selectedOrganization?.id;
  const prevOrganizationId = useRef<string | undefined>(organizationId);
  const [selectedLocation, setSelectedLocationState] =
    useState<SelectedLocation | null>(null);
  const categoriesQuery = useQuery({
    enabled: Boolean(organizationId),
    queryKey: ["organizations", organizationId, "categories"],
    queryFn: () => {
      if (!organizationId) {
        throw new Error(
          "A organização é obrigatória para carregar categorias.",
        );
      }

      return getOrganizationCategories(organizationId);
    },
    retry: false,
  });
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
  const createCategoryMutation = useMutation({
    mutationFn: (input: CategoryInput & { organizationId: string }) =>
      createOrganizationCategory(input.organizationId, {
        description: input.description,
        name: input.name,
      }),
    onSuccess: async (_category, variables) => {
      toast.success("Categoria criada.");
      await queryClient.invalidateQueries({
        queryKey: ["organizations", variables.organizationId, "categories"],
      });
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
  const errorMessage =
    organizationsQuery.error?.message ??
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
        <CategoriesManagementView
          categories={categoriesQuery.data ?? []}
          errorMessage={errorMessage}
          isCreating={createCategoryMutation.isPending}
          isLoading={
            organizationsQuery.isPending ||
            (hasOrganization ? categoriesQuery.isPending : false)
          }
          onCreate={
            organizationId
              ? async (input) => {
                  await createCategoryMutation.mutateAsync({
                    ...input,
                    organizationId,
                  });
                }
              : undefined
          }
          onRetry={() => {
            organizationsQuery.refetch();

            if (organizationId) {
              categoriesQuery.refetch();
              locationsQuery.refetch();
            }
          }}
          organization={selectedOrganization}
        />
      </div>
    </div>
  );
}
