"use client";

import { AlertCircle, ArrowRight, MapPin, Plus, RotateCw } from "lucide-react";
import Link from "next/link";
import type { FormEvent } from "react";
import { useState } from "react";
import type { Location, Organization } from "../../lib/api";
import { cn } from "../../lib/utils";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Spinner } from "../ui/spinner";

export type LocationInventorySummary = {
  itemCount: number;
  lowStockCount: number;
  totalQuantity: number;
  totalValue: number;
};

type LocationCreateInput = {
  address?: string;
  name: string;
};

type LocationsManagementViewProps = {
  createErrorMessage?: string;
  errorMessage?: string;
  isCreating?: boolean;
  isLoading?: boolean;
  locations: Location[];
  onCreate?: (input: LocationCreateInput) => Promise<void>;
  onRetry?: () => void;
  onSelectLocation?: (location: Location) => void;
  organization?: Organization | null;
  selectedLocationId?: string | null;
  summaries?: Record<string, LocationInventorySummary>;
};

const writeRoles = new Set(["admin", "manager"]);

/**
 * Formats BRL totals for compact inventory cards.
 *
 * @param value Currency value.
 * @returns Localized BRL currency string.
 */
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(value);

/**
 * Builds display copy for one location address.
 *
 * @param location Location record.
 * @returns Address or fallback copy.
 */
const getLocationAddress = (location: Location) => location.address ?? "No address set";

/**
 * Renders the role-aware locations management experience.
 *
 * @param props View props.
 * @returns Locations management UI.
 */
export function LocationsManagementView({
  createErrorMessage,
  errorMessage,
  isCreating = false,
  isLoading = false,
  locations,
  onCreate,
  onRetry,
  onSelectLocation,
  organization,
  selectedLocationId,
  summaries = {},
}: LocationsManagementViewProps) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const role = organization?.role?.toLowerCase() ?? "viewer";
  const canCreate = writeRoles.has(role);
  const hasLocations = locations.length > 0;

  /**
   * Submits the create-location form when the user can manage locations.
   *
   * @param event Form submit event.
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canCreate || !onCreate || !name.trim()) {
      return;
    }

    try {
      await onCreate({
        address: address.trim() || undefined,
        name: name.trim(),
      });
    } catch {
      return;
    }

    setName("");
    setAddress("");
  };

  if (isLoading) {
    return (
      <main className="grid min-h-[calc(100svh-4rem)] place-items-center bg-gray-50 p-6 md:min-h-screen">
        <Spinner />
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100svh-4rem)] bg-gray-50 p-4 text-[#16151c] md:min-h-screen md:p-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-purple-100 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="m-0 text-sm font-medium text-purple-600">
              {organization?.name ?? "Selected organization"}
            </p>
            <h1 className="m-0 mt-1 text-2xl font-semibold tracking-normal">Locations</h1>
            <p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-[#5c6670]">
              Manage warehouses and stores before opening location-scoped inventory.
            </p>
          </div>
          <Badge variant={canCreate ? "secondary" : "outline"}>
            {canCreate ? "Can create locations" : "Read-only access"}
          </Badge>
        </header>

        {!organization ? (
          <Alert variant="destructive">
            <AlertTitle>No organization selected</AlertTitle>
            <AlertDescription>Select an organization before managing locations.</AlertDescription>
          </Alert>
        ) : null}

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to load locations</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {!canCreate ? (
          <Alert>
            <AlertTitle>Viewer access</AlertTitle>
            <AlertDescription>
              Viewers can review locations and open inventory, but cannot create or edit locations.
            </AlertDescription>
          </Alert>
        ) : null}

        {canCreate ? (
          <Card>
            <CardHeader>
              <CardTitle>Create location</CardTitle>
              <CardDescription>Add a warehouse, store, or stock room for this organization.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto]" onSubmit={handleSubmit}>
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-xs font-semibold text-purple-700">Name</span>
                  <input
                    className="h-10 min-w-0 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300"
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Main Warehouse"
                    value={name}
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-xs font-semibold text-purple-700">Address</span>
                  <input
                    className="h-10 min-w-0 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300"
                    onChange={(event) => setAddress(event.target.value)}
                    placeholder="Rua A, 100"
                    value={address}
                  />
                </label>
                <Button className="self-end" disabled={isCreating || !name.trim()} type="submit">
                  {isCreating ? <RotateCw className="animate-spin" /> : <Plus />}
                  Add location
                </Button>
              </form>
              {createErrorMessage ? (
                <p className="m-0 mt-3 text-sm text-[#b42318]" role="alert">
                  {createErrorMessage}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {!errorMessage && !hasLocations ? (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>No locations yet</CardTitle>
              <CardDescription>
                {canCreate
                  ? "Create the first location to start location-scoped inventory work."
                  : "No locations are available for this organization yet."}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {hasLocations ? (
          <section className="grid gap-4 lg:grid-cols-2" aria-label="Organization locations">
            {locations.map((location) => {
              const summary = summaries[location.id];
              const isSelectedForInventory = location.id === selectedLocationId;

              return (
                <Card key={location.id}>
                  <CardHeader>
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-base">{location.name}</CardTitle>
                        <CardDescription className="mt-1 flex items-center gap-1.5">
                          <MapPin className="size-3.5 shrink-0 text-purple-500" />
                          <span className="truncate">{getLocationAddress(location)}</span>
                        </CardDescription>
                      </div>
                      <Badge variant={location.is_active === false ? "outline" : "secondary"}>
                        {location.is_active === false ? "Inactive" : "Active"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      <div>
                        <dt className="text-xs font-medium text-gray-500">Items</dt>
                        <dd className="m-0 mt-1 font-semibold">{summary?.itemCount ?? 0}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-gray-500">Quantity</dt>
                        <dd className="m-0 mt-1 font-semibold">{summary?.totalQuantity ?? 0}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-gray-500">Low stock</dt>
                        <dd
                          className={cn(
                            "m-0 mt-1 font-semibold",
                            summary?.lowStockCount ? "text-[#b42318]" : "text-[#16151c]",
                          )}
                        >
                          {summary?.lowStockCount ?? 0}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-gray-500">Value</dt>
                        <dd className="m-0 mt-1 font-semibold">
                          {formatCurrency(summary?.totalValue ?? 0)}
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <Button
                        onClick={() => onSelectLocation?.(location)}
                        type="button"
                        variant={isSelectedForInventory ? "default" : "outline"}
                      >
                        {isSelectedForInventory ? "Selected for inventory" : "Select for inventory"}
                      </Button>
                      <Link
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-purple-200 bg-purple-50 px-3 text-sm font-semibold text-purple-700 transition-colors hover:bg-purple-100 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300"
                        href={`/dashboard/locations/${location.id}/inventory`}
                        onClick={() => onSelectLocation?.(location)}
                      >
                        Open inventory
                        <ArrowRight className="size-4" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </section>
        ) : null}

        {errorMessage && onRetry ? (
          <Button className="w-fit" onClick={onRetry} type="button" variant="outline">
            <AlertCircle />
            Retry
          </Button>
        ) : null}
      </div>
    </main>
  );
}
