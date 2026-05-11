"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DashboardOverviewView,
  type DashboardOverviewMetrics,
} from "../components/dashboard/dashboard-overview-view";
import { Navbar } from "../components/navbar";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import {
  getCurrentUser,
  getOrganizationLocations,
  getOrganizationStock,
  getOrganizations,
  type Location,
  type Organization,
  type OrganizationStockLevel,
} from "../lib/api";
import {
  clearSelectedLocation,
  getSelectedLocation,
  getSelectedOrganizationId,
  setSelectedLocation,
  type SelectedLocation,
} from "../lib/organization-selection";

/**
 * Returns a localized greeting for the current time of day.
 *
 * @returns "Bom dia", "Boa tarde", or "Boa noite" based on the current hour.
 */
const getGreeting = () => {
  const hour = new Date().getHours();

  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
};

/**
 * Returns the organization selected for the current dashboard context.
 *
 * @returns Selected organization payload when available.
 */
const useSelectedOrganization = (): Organization | undefined => {
  const organizationsQuery = useQuery({
    queryKey: ["organizations"],
    queryFn: getOrganizations,
    retry: false,
  });
  const selectedOrganizationId = getSelectedOrganizationId();

  return organizationsQuery.data?.find(
    (organization) => organization.id === selectedOrganizationId,
  );
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
 * Aggregates organization stock rows into dashboard metrics.
 *
 * @param stock Organization stock rows.
 * @returns Overview metrics for the dashboard.
 */
export const getDashboardOverviewMetrics = (
  stock: OrganizationStockLevel[],
): DashboardOverviewMetrics => {
  const skuIds = new Set<string>();
  const lowStockItemIds = new Set<string>();
  let totalStockUnits = 0;
  let inventoryValue = 0;

  for (const stockLevel of stock) {
    skuIds.add(stockLevel.item_id);
    totalStockUnits += stockLevel.quantity;

    const unitPrice = Number(stockLevel.item.unit_price ?? 0);

    if (Number.isFinite(unitPrice)) {
      inventoryValue += stockLevel.quantity * unitPrice;
    }

    if (stockLevel.quantity <= stockLevel.item.reorder_point) {
      lowStockItemIds.add(stockLevel.item_id);
    }
  }

  return {
    inventoryValue,
    lowStockItems: lowStockItemIds.size,
    totalSkus: skuIds.size,
    totalStockUnits,
  };
};

/**
 * Renders the authenticated dashboard shell for the selected organization.
 *
 * @returns Dashboard page.
 */
const Dashboard = () => {
  const userQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentUser,
    retry: false,
  });
  const selectedOrganization = useSelectedOrganization();
  const organizationId = selectedOrganization?.id;
  const prevOrganizationId = useRef<string | undefined>(organizationId);
  const [selectedLocation, setSelectedLocationState] = useState<SelectedLocation | null>(null);
  const locationsQuery = useQuery({
    enabled: Boolean(organizationId),
    queryKey: ["organizations", organizationId, "locations"],
    queryFn: () => getOrganizationLocations(organizationId ?? ""),
    retry: false,
  });
  const stockQuery = useQuery({
    enabled: Boolean(organizationId),
    queryKey: ["organizations", organizationId, "stock-overview"],
    queryFn: () => {
      if (!organizationId) {
        throw new Error("A organização é obrigatória para carregar o painel.");
      }

      return getOrganizationStock(organizationId);
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
  const metrics = useMemo(
    () => getDashboardOverviewMetrics(stockQuery.data ?? []),
    [stockQuery.data],
  );
  const userName = userQuery.data?.name ?? "Usuário";
  const errorMessage =
    userQuery.error?.message ??
    (hasOrganization ? locationsQuery.error?.message : undefined) ??
    (hasOrganization ? stockQuery.error?.message : undefined);

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
        organization={selectedOrganization}
        selectedLocationId={selectedLocation?.id}
        selectedLocationName={selectedLocation?.name}
      />

      <div className="flex min-w-0 flex-1 flex-col pt-16 md:pt-0">
        {/* Topbar */}
        <header className="flex flex-col gap-4 border-b bg-white px-4 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between lg:px-6">
          {/* Greeting */}
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">
              {getGreeting()}, {userName}
            </h1>
            <p className="text-sm text-gray-500">
              {selectedOrganization ? selectedOrganization.name : "Selecione uma organização"}
            </p>
          </div>

          {/* Search */}
          <div className="w-full max-w-md lg:flex-1">
            <input
              type="text"
              placeholder="Buscar..."
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Profile */}
          <div className="flex items-center gap-3">
            <span className="min-w-0 truncate text-sm font-medium">{userName}</span>
            <Avatar>
              <AvatarFallback>{userName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </div>
        </header>

        <DashboardOverviewView
          activities={[]}
          errorMessage={errorMessage}
          isLoading={
            userQuery.isPending ||
            (hasOrganization ? locationsQuery.isPending : false) ||
            (hasOrganization ? stockQuery.isPending : false)
          }
          metrics={metrics}
          onRetry={() => {
            userQuery.refetch();

            if (organizationId) {
              locationsQuery.refetch();
              stockQuery.refetch();
            }
          }}
          organization={selectedOrganization}
        />
      </div>
    </div>
  );
};

export default Dashboard;
