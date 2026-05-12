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
import { Skeleton } from "../ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

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
    return "Não definido";
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
 * @returns Estoque do local UI.
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
      <main aria-busy="true" className="min-h-[calc(100svh-4rem)] bg-white p-4 md:min-h-screen md:p-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
          <div className="border-b border-purple-100 pb-5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="mt-3 h-8 w-56" />
            <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
          </div>
          <Skeleton className="h-40 w-full" />
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
            <h1 className="m-0 mt-1 text-2xl font-semibold tracking-normal">
              {location?.name ?? "Estoque do local"}
            </h1>
            <p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-[#5c6670]">
              Consulte quantidades, preços, categorias e status de reposição dos itens de um local.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={canCreate ? "secondary" : "outline"}>
              {canCreate ? "Pode criar itens" : "Acesso somente leitura"}
            </Badge>
            <Badge variant={lowStockCount ? "outline" : "secondary"}>{lowStockCount} estoque baixo</Badge>
          </div>
        </header>

        {!organization ? (
          <Alert variant="destructive">
            <AlertTitle>Nenhuma organização selecionada</AlertTitle>
            <AlertDescription>Selecione uma organização antes de abrir o estoque.</AlertDescription>
          </Alert>
        ) : null}

        {organization && !location ? (
          <Alert variant="destructive">
            <AlertTitle>Local indisponível</AlertTitle>
            <AlertDescription>
              Selecione um local ativo na navegação antes de consultar o estoque.
            </AlertDescription>
          </Alert>
        ) : null}

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>Não foi possível carregar o estoque</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {organization && !canCreate ? (
          <Alert variant="warning">
            <AlertTitle>Acesso de visualizador</AlertTitle>
            <AlertDescription>
              Visualizadores podem revisar o estoque, mas não podem criar ou editar itens do local.
            </AlertDescription>
          </Alert>
        ) : null}

        {canCreate && location ? (
          <Card>
            <CardHeader>
              <CardTitle>Criar item</CardTitle>
              <CardDescription>Adicione um produto a este local com quantidade inicial.</CardDescription>
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
                  <span className="text-xs font-semibold text-purple-700">Nome</span>
                  <input
                    className="h-10 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300"
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Leitor sem fio"
                    required
                    value={name}
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-xs font-semibold text-purple-700">Categoria</span>
                  <select
                    className="h-10 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300"
                    onChange={(event) => setCategoryId(event.target.value)}
                    value={categoryId}
                  >
                    <option value="">Sem categoria</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-xs font-semibold text-purple-700">Preço</span>
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
                  <span className="text-xs font-semibold text-purple-700">Quantidade</span>
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
                  <span className="text-xs font-semibold text-purple-700">Ponto de reposição</span>
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
                  <span className="text-xs font-semibold text-purple-700">Descrição</span>
                  <input
                    className="h-10 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300"
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Observações operacionais opcionais"
                    value={description}
                  />
                </label>
                <Button
                  className="self-end lg:col-span-2"
                  disabled={isCreating || !sku.trim() || !name.trim() || !unitPrice}
                  type="submit"
                >
                  {isCreating ? <RotateCw className="animate-spin" /> : <Plus />}
                  Adicionar item
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
              placeholder="SKU, nome ou categoria"
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
              <option value="all">Todas as categorias</option>
              <option value="uncategorized">Sem categoria</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xs font-semibold text-purple-700">Estoque</span>
            <select
              className="h-10 rounded-md border border-purple-200 bg-white px-3 text-sm outline-none focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300"
              onChange={(event) => setStockFilter(event.target.value)}
              value={stockFilter}
            >
              <option value="all">Todo estoque</option>
              <option value="low">Estoque baixo</option>
              <option value="healthy">Estoque saudável</option>
            </select>
          </label>
        </section>

        {!errorMessage && location && !items.length ? (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>Nenhum item ainda</CardTitle>
              <CardDescription>
                {canCreate
                  ? "Crie o primeiro item para começar a acompanhar o estoque deste local."
                  : "Nenhum item de estoque está disponível para este local ainda."}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {!errorMessage && items.length > 0 && !filteredItems.length ? (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>Nenhum item encontrado</CardTitle>
              <CardDescription>Ajuste a busca ou os filtros para ampliar a lista de estoque.</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {filteredItems.length ? (
          <div className="overflow-x-auto rounded-md border border-purple-100 bg-white">
            <Table className="min-w-[920px]">
              <TableHeader>
                <TableRow className="border-t-0">
                  <TableHead>SKU</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Preço unitário</TableHead>
                  <TableHead className="text-right">Reposição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Recebimento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const lowStock = isLowStock(item);

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                      <TableCell>
                        <div className="font-semibold">{item.name}</div>
                        {item.description ? (
                          <div className="mt-1 max-w-md truncate text-xs text-[#5c6670]">
                            {item.description}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>{item.category?.name ?? "Sem categoria"}</TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-semibold",
                          lowStock ? "text-[#b42318]" : "text-[#16151c]",
                        )}
                      >
                        {item.quantity}
                      </TableCell>
                      <TableCell className="text-right">{formatPrice(item.unit_price)}</TableCell>
                      <TableCell className="text-right">{item.reorder_point}</TableCell>
                      <TableCell>
                        <Badge variant={lowStock ? "outline" : "secondary"}>
                          {lowStock ? "Estoque baixo" : "Saudável"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {canCreate && location ? (
                          <Link
                            className="inline-flex min-h-8 items-center justify-center rounded-md border border-purple-200 bg-purple-50 px-2 text-xs font-semibold text-purple-700 transition-colors hover:bg-purple-100"
                            href={`/dashboard/receiving?${new URLSearchParams({
                              itemId: item.id,
                              locationId: location.id,
                            }).toString()}`}
                          >
                            Receber
                          </Link>
                        ) : (
                          <span className="text-xs text-[#5c6670]">Somente leitura</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
            Mostrando {filteredItems.length} de {items.length} {items.length === 1 ? "item" : "itens"}
          </div>
        ) : null}
      </div>
    </main>
  );
}
