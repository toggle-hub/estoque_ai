"use client";

import { AlertCircle, Filter, Plus, RotateCw, Search } from "lucide-react";
import Link from "next/link";
import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import type { Category, Location, LocationItem, LocationItemInput, Organization } from "../../lib/api";
import { cn } from "../../lib/utils";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Spinner } from "../ui/spinner";

export type LocationInventoryViewProps = {
  categories?: Category[];
  createErrorMessage?: string;
  errorMessage?: string;
  isCreating?: boolean;
  isLoading?: boolean;
  items: LocationItem[];
  location?: Location | null;
  onCreate?: (input: LocationItemInput) => Promise<void>;
  onRetry?: () => void;
  organization?: Organization | null;
};

const writeRoles = new Set(["admin", "manager"]);

/**
 * Formats item prices for BRL display.
 *
 * @param value Numeric string from the API.
 * @returns Localized price or fallback copy.
 */
const formatPrice = (value: string | null) => {
  if (value === null) {
    return "Not set";
  }

  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(Number(value));
};

/**
 * Returns true when current quantity is at or below reorder point.
 *
 * @param item Location item row.
 * @returns Low-stock state.
 */
const isLowStock = (item: LocationItem) => item.quantity <= item.reorder_point;

/**
 * Renders location-scoped inventory browsing and item creation.
 *
 * @param props View props.
 * @returns Location inventory UI.
 */
export function LocationInventoryView({
  categories = [],
  createErrorMessage,
  errorMessage,
  isCreating = false,
  isLoading = false,
  items,
  location,
  onCreate,
  onRetry,
  organization,
}: LocationInventoryViewProps) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [reorderPoint, setReorderPoint] = useState("0");
  const [quantity, setQuantity] = useState("0");
  const role = organization?.role?.toLowerCase() ?? "viewer";
  const canCreate = writeRoles.has(role);
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return items.filter((item) => {
      const matchesQuery =
        !normalizedQuery ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.sku.toLowerCase().includes(normalizedQuery) ||
        item.category?.name.toLowerCase().includes(normalizedQuery);
      const matchesCategory =
        categoryFilter === "all" ||
        (categoryFilter === "uncategorized" ? !item.category : item.category?.id === categoryFilter);
      const matchesStock =
        stockFilter === "all" || (stockFilter === "low" ? isLowStock(item) : !isLowStock(item));

      return matchesQuery && matchesCategory && matchesStock;
    });
  }, [categoryFilter, items, query, stockFilter]);
  const lowStockCount = items.filter(isLowStock).length;

  /**
   * Submits a new item for the selected location.
   *
   * @param event Form submit event.
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canCreate || !onCreate || !sku.trim() || !name.trim() || !unitPrice) {
      return;
    }

    try {
      await onCreate({
        category_id: categoryId || undefined,
        description: description.trim() || undefined,
        name: name.trim(),
        quantity: Number(quantity || 0),
        reorder_point: Number(reorderPoint || 0),
        sku: sku.trim(),
        unit_price: Number(unitPrice),
      });
    } catch {
      return;
    }

    setSku("");
    setName("");
    setDescription("");
    setCategoryId("");
    setUnitPrice("");
    setReorderPoint("0");
    setQuantity("0");
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
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-purple-100 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="m-0 text-sm font-medium text-purple-600">
              {organization?.name ?? "Selected organization"}
            </p>
            <h1 className="m-0 mt-1 text-2xl font-semibold tracking-normal">
              {location?.name ?? "Location inventory"}
            </h1>
            <p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-[#5c6670]">
              Browse item quantities, pricing, categories, and reorder status for one location.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={canCreate ? "secondary" : "outline"}>
              {canCreate ? "Can create items" : "Read-only access"}
            </Badge>
            <Badge variant={lowStockCount ? "outline" : "secondary"}>{lowStockCount} low stock</Badge>
          </div>
        </header>

        {!organization ? (
          <Alert variant="destructive">
            <AlertTitle>No organization selected</AlertTitle>
            <AlertDescription>Select an organization before opening inventory.</AlertDescription>
          </Alert>
        ) : null}

        {organization && !location ? (
          <Alert variant="destructive">
            <AlertTitle>Location unavailable</AlertTitle>
            <AlertDescription>
              Select an active location from the navigation before browsing inventory.
            </AlertDescription>
          </Alert>
        ) : null}

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to load inventory</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {organization && !canCreate ? (
          <Alert>
            <AlertTitle>Viewer access</AlertTitle>
            <AlertDescription>
              Viewers can review inventory, but cannot create or edit location items.
            </AlertDescription>
          </Alert>
        ) : null}

        {canCreate && location ? (
          <Card>
            <CardHeader>
              <CardTitle>Create item</CardTitle>
              <CardDescription>Add a product row to this location with initial quantity.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3 lg:grid-cols-6" onSubmit={handleSubmit}>
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-xs font-semibold text-purple-700">SKU</span>
                  <input
                    className="h-10 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300"
                    onChange={(event) => setSku(event.target.value)}
                    placeholder="SKU-100"
                    required
                    value={sku}
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1.5 lg:col-span-2">
                  <span className="text-xs font-semibold text-purple-700">Name</span>
                  <input
                    className="h-10 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300"
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Wireless Scanner"
                    required
                    value={name}
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-xs font-semibold text-purple-700">Category</span>
                  <select
                    className="h-10 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300"
                    onChange={(event) => setCategoryId(event.target.value)}
                    value={categoryId}
                  >
                    <option value="">No category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-xs font-semibold text-purple-700">Price</span>
                  <input
                    className="h-10 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300"
                    min="0"
                    onChange={(event) => setUnitPrice(event.target.value)}
                    placeholder="99.90"
                    required
                    step="0.01"
                    type="number"
                    value={unitPrice}
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-xs font-semibold text-purple-700">Quantity</span>
                  <input
                    className="h-10 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300"
                    min="0"
                    onChange={(event) => setQuantity(event.target.value)}
                    step="1"
                    type="number"
                    value={quantity}
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-xs font-semibold text-purple-700">Reorder point</span>
                  <input
                    className="h-10 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300"
                    min="0"
                    onChange={(event) => setReorderPoint(event.target.value)}
                    step="1"
                    type="number"
                    value={reorderPoint}
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1.5 lg:col-span-4">
                  <span className="text-xs font-semibold text-purple-700">Description</span>
                  <input
                    className="h-10 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300"
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Optional operational notes"
                    value={description}
                  />
                </label>
                <Button
                  className="self-end lg:col-span-2"
                  disabled={isCreating || !sku.trim() || !name.trim() || !unitPrice}
                  type="submit"
                >
                  {isCreating ? <RotateCw className="animate-spin" /> : <Plus />}
                  Add item
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

        <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_180px]">
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700">
              <Search className="size-3.5" />
              Search
            </span>
            <input
              className="h-10 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="SKU, name, or category"
              value={query}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700">
              <Filter className="size-3.5" />
              Category
            </span>
            <select
              className="h-10 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300"
              onChange={(event) => setCategoryFilter(event.target.value)}
              value={categoryFilter}
            >
              <option value="all">All categories</option>
              <option value="uncategorized">Uncategorized</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs font-semibold text-purple-700">Stock</span>
            <select
              className="h-10 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300"
              onChange={(event) => setStockFilter(event.target.value)}
              value={stockFilter}
            >
              <option value="all">All stock</option>
              <option value="low">Low stock</option>
              <option value="healthy">Healthy stock</option>
            </select>
          </label>
        </section>

        {!errorMessage && location && !items.length ? (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>No items yet</CardTitle>
              <CardDescription>
                {canCreate
                  ? "Create the first item to begin tracking stock at this location."
                  : "No inventory items are available for this location yet."}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {!errorMessage && items.length > 0 && !filteredItems.length ? (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>No matching items</CardTitle>
              <CardDescription>Adjust search or filters to widen the inventory list.</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {filteredItems.length ? (
          <div className="overflow-x-auto rounded-md border border-purple-100 bg-white">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead className="bg-purple-50 text-xs font-semibold text-purple-700">
                <tr>
                  <th className="px-3 py-3">SKU</th>
                  <th className="px-3 py-3">Name</th>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3 text-right">Quantity</th>
                  <th className="px-3 py-3 text-right">Unit price</th>
                  <th className="px-3 py-3 text-right">Reorder</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Receiving</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const lowStock = isLowStock(item);

                  return (
                    <tr className="border-t border-purple-100" key={item.id}>
                      <td className="px-3 py-3 font-mono text-xs">{item.sku}</td>
                      <td className="px-3 py-3">
                        <div className="font-semibold">{item.name}</div>
                        {item.description ? (
                          <div className="mt-1 max-w-md truncate text-xs text-[#5c6670]">
                            {item.description}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">{item.category?.name ?? "Uncategorized"}</td>
                      <td
                        className={cn(
                          "px-3 py-3 text-right font-semibold",
                          lowStock ? "text-[#b42318]" : "text-[#16151c]",
                        )}
                      >
                        {item.quantity}
                      </td>
                      <td className="px-3 py-3 text-right">{formatPrice(item.unit_price)}</td>
                      <td className="px-3 py-3 text-right">{item.reorder_point}</td>
                      <td className="px-3 py-3">
                        <Badge variant={lowStock ? "outline" : "secondary"}>
                          {lowStock ? "Low stock" : "Healthy"}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        {canCreate && location ? (
                          <Link
                            className="inline-flex min-h-8 items-center justify-center rounded-md border border-purple-200 bg-purple-50 px-2 text-xs font-semibold text-purple-700 transition-colors hover:bg-purple-100"
                            href={`/dashboard/receiving?${new URLSearchParams({
                              itemId: item.id,
                              locationId: location.id,
                            }).toString()}`}
                          >
                            Receive
                          </Link>
                        ) : (
                          <span className="text-xs text-[#5c6670]">Read-only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {errorMessage && onRetry ? (
          <Button className="w-fit" onClick={onRetry} type="button" variant="outline">
            <AlertCircle />
            Retry
          </Button>
        ) : null}

        {!errorMessage && items.length ? (
          <div className="text-sm text-purple-700">
            Showing {filteredItems.length} of {items.length} {items.length === 1 ? "item" : "items"}
          </div>
        ) : null}
      </div>
    </main>
  );
}
