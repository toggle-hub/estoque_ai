"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Navbar } from "../../components/navbar";
import { TransactionsHistoryView } from "../../components/transactions/transactions-history-view";
import {
  getOrganizationLocations,
  getOrganizations,
  type Location,
  type Organization,
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

type TransactionsPageViewProps = {
  activeLocations: Location[];
  errorMessage?: string;
  hasLocationLoadError: boolean;
  isLoading: boolean;
  isLoadingLocations: boolean;
  onRetry: () => void;
  onSelectLocation: (location: Location) => void;
  organization?: Organization;
  selectedLocation?: SelectedLocation | null;
};

/**
 * Renders composed transaction history page content.
 *
 * @param props Page view props.
 * @returns Transactions page shell with navigation and history content.
 */
export function TransactionsPageView({
  activeLocations,
  errorMessage,
  hasLocationLoadError,
  isLoading,
  isLoadingLocations,
  onRetry,
  onSelectLocation,
  organization,
  selectedLocation,
}: TransactionsPageViewProps) {
  return (
    <div className="min-h-screen bg-white md:flex">
      <Navbar
        hasLocationLoadError={hasLocationLoadError}
        isLoadingLocations={isLoadingLocations}
        locations={activeLocations}
        onSelectLocation={onSelectLocation}
        organization={organization}
        selectedLocationId={selectedLocation?.id}
        selectedLocationName={selectedLocation?.name}
      />

      <div className="min-w-0 flex-1 pt-16 md:pt-0">
        <TransactionsHistoryView
          errorMessage={errorMessage}
          isLoading={isLoading}
          locations={activeLocations}
          onRetry={onRetry}
          organization={organization}
          transactions={[]}
        />
      </div>
    </div>
  );
}

/**
 * Renders the transaction history page.
 *
 * @returns Transaction history page.
 */
export default function TransactionsPage() {
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
  const hasOrganization = Boolean(organizationId);
  const isLoadingLocations = hasOrganization ? locationsQuery.isPending : false;
  const hasLocationLoadError = hasOrganization ? Boolean(locationsQuery.error) : false;
  const activeLocations = useMemo(
    () => getActiveLocations(locationsQuery.data ?? []),
    [locationsQuery.data],
  );
  const errorMessage =
    organizationsQuery.error?.message ??
    (hasOrganization ? locationsQuery.error?.message : undefined);

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
    <TransactionsPageView
      activeLocations={activeLocations}
      errorMessage={errorMessage}
      hasLocationLoadError={hasLocationLoadError}
      isLoading={organizationsQuery.isPending || isLoadingLocations}
      isLoadingLocations={isLoadingLocations}
      onRetry={() => {
        organizationsQuery.refetch();

        if (organizationId) {
          locationsQuery.refetch();
        }
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
      selectedLocation={selectedLocation}
    />
  );
}
