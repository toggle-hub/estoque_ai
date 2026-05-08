"use client";

import { AlertCircle, CheckCircle2, PackagePlus, RotateCw, Search } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import type {
  Location,
  LocationItem,
  Organization,
  ReceivingTransactionInput,
  ReceivingTransactionResult,
} from "../../lib/api";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Spinner } from "../ui/spinner";

export type ReceivingViewProps = {
  errorMessage?: string;
  isLoading?: boolean;
  isSubmitting?: boolean;
  items: ReceivingItem[];
  locations: Location[];
  onReceive?: (input: ReceivingTransactionInput & { locationId: string }) => Promise<void>;
  onRetry?: () => void;
  organization?: Organization | null;
  preselectedItemId?: string | null;
  preselectedLocationId?: string | null;
  submitErrorMessage?: string;
  successResult?: ReceivingTransactionResult | null;
};

export type ReceivingItem = LocationItem & {
  location_id: string;
};

const writeRoles = new Set(["admin", "manager"]);

/**
 * Returns searchable item copy for filtering.
 *
 * @param item Location item row.
 * @returns Search index copy.
 */
const getSearchText = (item: LocationItem) =>
  `${item.sku} ${item.name} ${item.category?.name ?? ""}`.toLowerCase();

/**
 * Renders stock receiving workflow.
 *
 * @param props View props.
 * @returns Receiving workflow UI.
 */
export function ReceivingView({
  errorMessage,
  isLoading = false,
  isSubmitting = false,
  items,
  locations,
  onReceive,
  onRetry,
  organization,
  preselectedItemId,
  preselectedLocationId,
  submitErrorMessage,
  successResult,
}: ReceivingViewProps) {
  const [locationId, setLocationId] = useState(preselectedLocationId ?? "");
  const [itemId, setItemId] = useState(preselectedItemId ?? "");
  const [quantity, setQuantity] = useState("1");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [query, setQuery] = useState("");
  const [validationError, setValidationError] = useState("");
  const role = organization?.role?.toLowerCase() ?? "viewer";
  const canReceive = writeRoles.has(role);
  const selectedLocation = locations.find((location) => location.id === locationId);
  const locationItems = items.filter((item) => item.location_id === locationId);
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return locationItems.filter((item) => !normalizedQuery || getSearchText(item).includes(normalizedQuery));
  }, [locationItems, query]);
  const selectedItem = locationItems.find((item) => item.id === itemId);

  useEffect(() => {
    setLocationId(preselectedLocationId ?? "");
  }, [preselectedLocationId]);

  useEffect(() => {
    setItemId(preselectedItemId ?? "");
  }, [preselectedItemId]);

  useEffect(() => {
    if (!locationId && locations.length === 1 && locations[0]) {
      setLocationId(locations[0].id);
    }
  }, [locationId, locations]);

  useEffect(() => {
    if (itemId && !locationItems.some((item) => item.id === itemId)) {
      setItemId("");
    }
  }, [itemId, locationItems]);

  /**
   * Submits a receiving transaction.
   *
   * @param event Form submit event.
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError("");

    const parsedQuantity = Number(quantity);

    if (!canReceive || !onReceive) {
      return;
    }

    if (!locationId || !itemId) {
      setValidationError("Choose a location and item before receiving stock.");
      return;
    }

    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      setValidationError("Quantity must be a positive whole number.");
      return;
    }

    await onReceive({
      item_id: itemId,
      locationId,
      notes: notes.trim() || undefined,
      quantity: parsedQuantity,
      reference: reference.trim() || undefined,
    });
  };

  if (isLoading) {
    return (
      <main className="grid min-h-[calc(100svh-4rem)] place-items-center bg-white p-6 md:min-h-screen">
        <Spinner />
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100svh-4rem)] bg-white p-4 text-[#16151c] md:min-h-screen md:p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-purple-100 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="m-0 text-sm font-medium text-purple-600">
              {organization?.name ?? "Selected organization"}
            </p>
            <h1 className="m-0 mt-1 text-2xl font-semibold tracking-normal">Receiving</h1>
            <p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-[#5c6670]">
              Add inbound stock to an existing location item and record the transaction.
            </p>
          </div>
          <Badge variant={canReceive ? "secondary" : "outline"}>
            {canReceive ? "Can receive stock" : "Read-only access"}
          </Badge>
        </header>

        {!organization ? (
          <Alert variant="destructive">
            <AlertTitle>No organization selected</AlertTitle>
            <AlertDescription>Select an organization before receiving stock.</AlertDescription>
          </Alert>
        ) : null}

        {organization && !canReceive ? (
          <Alert variant="destructive">
            <AlertTitle>Receiving unavailable</AlertTitle>
            <AlertDescription>
              Viewers can review inventory, but cannot create receiving transactions.
            </AlertDescription>
          </Alert>
        ) : null}

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to load receiving data</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {successResult ? (
          <Alert>
            <CheckCircle2 className="absolute top-4 left-4 size-4 text-purple-500" />
            <div className="pl-6">
              <AlertTitle>Stock received</AlertTitle>
              <AlertDescription>
                Quantity moved from {successResult.transaction.previous_quantity} to{" "}
                {successResult.transaction.new_quantity}.
              </AlertDescription>
            </div>
          </Alert>
        ) : null}

        {canReceive ? (
          <Card>
            <CardHeader>
              <CardTitle>Receive stock</CardTitle>
              <CardDescription>
                Choose a location item, enter quantity, and submit one receiving movement.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={handleSubmit}>
                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-xs font-semibold text-purple-700">Location</span>
                    <select
                      className="h-10 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:bg-purple-50"
                      disabled={isSubmitting}
                      onChange={(event) => {
                        setLocationId(event.target.value);
                        setItemId("");
                      }}
                      required
                      value={locationId}
                    >
                      <option value="">Select location</option>
                      {locations.map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700">
                      <Search className="size-3.5" />
                      Search item
                    </span>
                    <input
                      className="h-10 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:bg-purple-50"
                      disabled={isSubmitting || !locationId}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="SKU, name, or category"
                      value={query}
                    />
                  </label>
                </div>

                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-xs font-semibold text-purple-700">Item</span>
                  <select
                    className="h-10 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:bg-purple-50"
                    disabled={isSubmitting || !locationId}
                    onChange={(event) => setItemId(event.target.value)}
                    required
                    value={itemId}
                  >
                    <option value="">
                      {selectedLocation ? "Select item" : "Select location first"}
                    </option>
                    {filteredItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.sku} - {item.name} ({item.quantity} on hand)
                      </option>
                    ))}
                  </select>
                </label>

                {selectedItem ? (
                  <div className="rounded-md border border-purple-100 bg-purple-50 px-3 py-2 text-sm">
                    <span className="font-semibold">{selectedItem.name}</span>
                    <span className="ml-2 text-purple-700">
                      Current quantity: {selectedItem.quantity}
                    </span>
                  </div>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-3">
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-xs font-semibold text-purple-700">Quantity</span>
                    <input
                      className="h-10 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:bg-purple-50"
                      disabled={isSubmitting}
                      min="1"
                      onChange={(event) => setQuantity(event.target.value)}
                      required
                      step="1"
                      type="number"
                      value={quantity}
                    />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-xs font-semibold text-purple-700">Reference</span>
                    <input
                      className="h-10 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:bg-purple-50"
                      disabled={isSubmitting}
                      onChange={(event) => setReference(event.target.value)}
                      placeholder="NF-000123"
                      value={reference}
                    />
                  </label>
                  <label className="flex min-w-0 flex-col gap-1.5">
                    <span className="text-xs font-semibold text-purple-700">Notes</span>
                    <input
                      className="h-10 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:bg-purple-50"
                      disabled={isSubmitting}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Supplier delivery"
                      value={notes}
                    />
                  </label>
                </div>

                {validationError ? (
                  <p className="m-0 text-sm text-[#b42318]" role="alert">
                    {validationError}
                  </p>
                ) : null}

                {submitErrorMessage ? (
                  <p className="m-0 text-sm text-[#b42318]" role="alert">
                    {submitErrorMessage}
                  </p>
                ) : null}

                <Button
                  className="justify-self-start"
                  disabled={isSubmitting || !locationId || !itemId || !quantity}
                  type="submit"
                >
                  {isSubmitting ? <RotateCw className="animate-spin" /> : <PackagePlus />}
                  Receive stock
                </Button>
              </form>
            </CardContent>
          </Card>
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
