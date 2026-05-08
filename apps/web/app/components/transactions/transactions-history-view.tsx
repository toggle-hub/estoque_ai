"use client";

import { AlertCircle, CalendarDays, Filter, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Location, Organization } from "../../lib/api";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Spinner } from "../ui/spinner";

export type InventoryTransaction = {
  id: string;
  type: string;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reference: string | null;
  notes: string | null;
  performedBy: string | null;
  createdAt: string;
  item: {
    id: string;
    sku: string;
    name: string;
  } | null;
  location: {
    id: string;
    name: string;
  } | null;
};

export type TransactionsHistoryViewProps = {
  errorMessage?: string;
  isLoading?: boolean;
  locations?: Location[];
  onRetry?: () => void;
  organization?: Organization | null;
  transactions: InventoryTransaction[];
};

/**
 * Formats transaction timestamps for audit tables.
 *
 * @param value ISO timestamp.
 * @returns Localized timestamp.
 */
const formatTimestamp = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

/**
 * Renders a read-only inventory transaction audit trail.
 *
 * @param props View props.
 * @returns Transaction history UI.
 */
export function TransactionsHistoryView({
  errorMessage,
  isLoading = false,
  locations = [],
  onRetry,
  organization,
  transactions,
}: TransactionsHistoryViewProps) {
  const [query, setQuery] = useState("");
  const [locationId, setLocationId] = useState("all");
  const [type, setType] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const transactionTypes = useMemo(
    () => Array.from(new Set(transactions.map((transaction) => transaction.type))).sort(),
    [transactions],
  );
  const filteredTransactions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTime = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;

    return transactions.filter((transaction) => {
      const createdTime = new Date(transaction.createdAt).getTime();
      const matchesQuery =
        !normalizedQuery ||
        transaction.item?.name.toLowerCase().includes(normalizedQuery) ||
        transaction.item?.sku.toLowerCase().includes(normalizedQuery) ||
        transaction.reference?.toLowerCase().includes(normalizedQuery) ||
        transaction.notes?.toLowerCase().includes(normalizedQuery);
      const matchesLocation = locationId === "all" || transaction.location?.id === locationId;
      const matchesType = type === "all" || transaction.type === type;
      const matchesDateFrom = fromTime === null || createdTime >= fromTime;
      const matchesDateTo = toTime === null || createdTime <= toTime;

      return matchesQuery && matchesLocation && matchesType && matchesDateFrom && matchesDateTo;
    });
  }, [dateFrom, dateTo, locationId, query, transactions, type]);

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
            <h1 className="m-0 mt-1 text-2xl font-semibold tracking-normal">Transactions</h1>
            <p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-[#5c6670]">
              Review immutable inventory movement history for reconciliation and audit.
            </p>
          </div>
          <Badge variant="outline">Read-only audit trail</Badge>
        </header>

        {!organization ? (
          <Alert variant="destructive">
            <AlertTitle>No organization selected</AlertTitle>
            <AlertDescription>Select an organization before reviewing transactions.</AlertDescription>
          </Alert>
        ) : null}

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to load transactions</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_180px_160px_160px]">
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700">
              <Search className="size-3.5" />
              Search
            </span>
            <input
              className="h-10 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="SKU, item, reference, or notes"
              value={query}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700">
              <Filter className="size-3.5" />
              Location
            </span>
            <select
              className="h-10 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300"
              onChange={(event) => setLocationId(event.target.value)}
              value={locationId}
            >
              <option value="all">All locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs font-semibold text-purple-700">Type</span>
            <select
              className="h-10 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300"
              onChange={(event) => setType(event.target.value)}
              value={type}
            >
              <option value="all">All types</option>
              {transactionTypes.map((transactionType) => (
                <option key={transactionType} value={transactionType}>
                  {transactionType}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700">
              <CalendarDays className="size-3.5" />
              From
            </span>
            <input
              className="h-10 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300"
              onChange={(event) => setDateFrom(event.target.value)}
              type="date"
              value={dateFrom}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs font-semibold text-purple-700">To</span>
            <input
              className="h-10 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300"
              onChange={(event) => setDateTo(event.target.value)}
              type="date"
              value={dateTo}
            />
          </label>
        </section>

        {!errorMessage && !transactions.length ? (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>No transactions yet</CardTitle>
              <CardDescription>
                Inventory movements will appear here after stock operations are recorded.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {!errorMessage && transactions.length > 0 && !filteredTransactions.length ? (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>No matching transactions</CardTitle>
              <CardDescription>Adjust filters to widen the audit trail.</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {filteredTransactions.length ? (
          <div className="overflow-x-auto rounded-md border border-purple-100 bg-white">
            <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
              <thead className="bg-purple-50 text-xs font-semibold text-purple-700">
                <tr>
                  <th className="px-3 py-3">Timestamp</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Item</th>
                  <th className="px-3 py-3">Location</th>
                  <th className="px-3 py-3 text-right">Qty</th>
                  <th className="px-3 py-3 text-right">Previous</th>
                  <th className="px-3 py-3 text-right">New</th>
                  <th className="px-3 py-3">Reference</th>
                  <th className="px-3 py-3">Notes</th>
                  <th className="px-3 py-3">Performed by</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((transaction) => (
                  <tr className="border-t border-purple-100" key={transaction.id}>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {formatTimestamp(transaction.createdAt)}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="secondary">{transaction.type}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-semibold">{transaction.item?.name ?? "Unknown item"}</div>
                      <div className="mt-1 font-mono text-xs text-[#5c6670]">
                        {transaction.item?.sku ?? "No SKU"}
                      </div>
                    </td>
                    <td className="px-3 py-3">{transaction.location?.name ?? "Unknown location"}</td>
                    <td className="px-3 py-3 text-right font-semibold">{transaction.quantity}</td>
                    <td className="px-3 py-3 text-right">{transaction.previousQuantity}</td>
                    <td className="px-3 py-3 text-right">{transaction.newQuantity}</td>
                    <td className="px-3 py-3">{transaction.reference ?? "-"}</td>
                    <td className="px-3 py-3">{transaction.notes ?? "-"}</td>
                    <td className="px-3 py-3 font-mono text-xs">
                      {transaction.performedBy ?? "Unknown"}
                    </td>
                  </tr>
                ))}
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

        {!errorMessage && transactions.length ? (
          <div className="text-sm text-purple-700">
            Showing {filteredTransactions.length} of {transactions.length}{" "}
            {transactions.length === 1 ? "transaction" : "transactions"}
          </div>
        ) : null}
      </div>
    </main>
  );
}
