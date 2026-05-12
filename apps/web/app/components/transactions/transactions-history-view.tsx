"use client";

import { AlertCircle, CalendarDays, Filter, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Location, Organization } from "../../lib/api";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Field } from "../ui/field";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectItem } from "../ui/select";
import { Skeleton } from "../ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

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

const transactionTypeLabels: Record<string, string> = {
  ADJUSTMENT: "Ajuste",
  RECEIVING: "Recebimento",
  SALE: "Venda",
  TRANSFER: "Transferência",
};

/**
 * Returns localized copy for a transaction type.
 *
 * @param transactionType Transaction type value from the API.
 * @returns Localized transaction type label.
 */
const getTransactionTypeLabel = (transactionType: string) =>
  transactionTypeLabels[transactionType] ?? transactionType;

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
      <main aria-busy="true" className="min-h-[calc(100svh-4rem)] bg-white p-4 md:min-h-screen md:p-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
          <div className="border-b border-purple-100 pb-5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-3 h-8 w-40" />
            <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_180px_160px_160px]">
            {Array.from({ length: 5 }, (_, index) => <Skeleton className="h-16" key={index} />)}
          </div>
          <Skeleton className="h-80 w-full" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100svh-4rem)] bg-white p-4 text-[#16151c] md:min-h-screen md:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-purple-100 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="m-0 text-sm font-medium text-purple-600">
              {organization?.name ?? "Organização selecionada"}
            </p>
            <h1 className="m-0 mt-1 text-2xl font-semibold tracking-normal">Transações</h1>
            <p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-[#5c6670]">
              Revise o histórico imutável de movimentações de estoque para conciliação e auditoria.
            </p>
          </div>
          <Badge variant="outline">Trilha de auditoria somente leitura</Badge>
        </header>

        {!organization ? (
          <Alert variant="destructive">
            <AlertTitle>Nenhuma organização selecionada</AlertTitle>
            <AlertDescription>Selecione uma organização antes de revisar transações.</AlertDescription>
          </Alert>
        ) : null}

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>Não foi possível carregar as transações</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_180px_160px_160px]">
          <Field>
            <Label htmlFor="transaction-search">
              <Search className="size-3.5" />
              Busca
            </Label>
            <Input
              id="transaction-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="SKU, item, referência ou observações"
              value={query}
            />
          </Field>
          <Field>
            <Label htmlFor="transaction-location">
              <Filter className="size-3.5" />
              Local
            </Label>
            <Select
              id="transaction-location"
              onChange={(event) => setLocationId(event.target.value)}
              value={locationId}
            >
              <SelectItem value="all">Todos os locais</SelectItem>
              {locations.map((location) => (
                <SelectItem key={location.id} value={location.id}>
                  {location.name}
                </SelectItem>
              ))}
            </Select>
          </Field>
          <Field>
            <Label htmlFor="transaction-type">Tipo</Label>
            <Select
              id="transaction-type"
              onChange={(event) => setType(event.target.value)}
              value={type}
            >
              <SelectItem value="all">Todos os tipos</SelectItem>
              {transactionTypes.map((transactionType) => (
                <SelectItem key={transactionType} value={transactionType}>
                  {getTransactionTypeLabel(transactionType)}
                </SelectItem>
              ))}
            </Select>
          </Field>
          <Field>
            <Label htmlFor="transaction-date-from">
              <CalendarDays className="size-3.5" />
              De
            </Label>
            <Input
              id="transaction-date-from"
              onChange={(event) => setDateFrom(event.target.value)}
              type="date"
              value={dateFrom}
            />
          </Field>
          <Field>
            <Label htmlFor="transaction-date-to">Até</Label>
            <Input
              id="transaction-date-to"
              onChange={(event) => setDateTo(event.target.value)}
              type="date"
              value={dateTo}
            />
          </Field>
        </section>

        {organization && !errorMessage && !transactions.length ? (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>Nenhuma transação ainda</CardTitle>
              <CardDescription>
                Movimentações de estoque aparecerão aqui após o registro das operações.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {organization && !errorMessage && transactions.length > 0 && !filteredTransactions.length ? (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>Nenhuma transação encontrada</CardTitle>
              <CardDescription>Ajuste os filtros para ampliar a trilha de auditoria.</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {filteredTransactions.length ? (
          <div className="overflow-x-auto rounded-md border border-purple-100 bg-white">
            <Table className="min-w-[1180px]">
              <TableHeader>
                <TableRow className="border-t-0">
                  <TableHead>Data e hora</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead className="text-right">Anterior</TableHead>
                  <TableHead className="text-right">Nova</TableHead>
                  <TableHead>Referência</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead>Realizada por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatTimestamp(transaction.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{getTransactionTypeLabel(transaction.type)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold">{transaction.item?.name ?? "Item desconhecido"}</div>
                      <div className="mt-1 font-mono text-xs text-[#5c6670]">
                        {transaction.item?.sku ?? "Sem SKU"}
                      </div>
                    </TableCell>
                    <TableCell>{transaction.location?.name ?? "Local desconhecido"}</TableCell>
                    <TableCell className="text-right font-semibold">{transaction.quantity}</TableCell>
                    <TableCell className="text-right">{transaction.previousQuantity}</TableCell>
                    <TableCell className="text-right">{transaction.newQuantity}</TableCell>
                    <TableCell>{transaction.reference ?? "-"}</TableCell>
                    <TableCell>{transaction.notes ?? "-"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {transaction.performedBy ?? "Desconhecido"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {errorMessage && onRetry ? (
          <Button className="w-fit" onClick={onRetry} type="button" variant="outline">
            <AlertCircle />
            Tentar novamente
          </Button>
        ) : null}

        {!errorMessage && transactions.length ? (
          <div className="text-sm text-purple-700">
            Mostrando {filteredTransactions.length} de {transactions.length}{" "}
            {transactions.length === 1 ? "transação" : "transações"}
          </div>
        ) : null}
      </div>
    </main>
  );
}
