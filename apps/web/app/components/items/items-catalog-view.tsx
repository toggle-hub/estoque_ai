"use client";

import { AlertCircle, ArrowRight, Filter, PackagePlus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { Organization } from "../../lib/api";
import { cn } from "../../lib/utils";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Spinner } from "../ui/spinner";

export type CatalogLocationAvailability = {
  locationId: string;
  locationName: string;
  quantity: number;
  inventoryHref: string;
};

export type CatalogItem = {
  id: string;
  sku: string;
  name: string;
  categoryName: string | null;
  description: string | null;
  unitPrice: string | null;
  reorderPoint: number;
  totalQuantity: number;
  locations: CatalogLocationAvailability[];
};

export type ItemsCatalogViewProps = {
  errorMessage?: string;
  isLoading?: boolean;
  items: CatalogItem[];
  onRetry?: () => void;
  organization?: Organization | null;
  selectedLocationId?: string | null;
};

const writeRoles = new Set(["admin", "manager"]);

/**
 * Narrows nullable category names to strings.
 *
 * @param value Category name candidate.
 * @returns True when the value is a string.
 */
const isCategoryName = (value: string | null): value is string => typeof value === "string";

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

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return "Preço inválido";
  }

  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(numericValue);
};

/**
 * Returns whether any location is at or below the item's reorder point.
 *
 * @param item Catalog item.
 * @returns Low-stock state.
 */
const hasLowStock = (item: CatalogItem) =>
  item.locations.some((location) => location.quantity <= item.reorderPoint);

/**
 * Renders organization-wide item catalog browsing.
 *
 * @param props View props.
 * @returns Catálogo de itens UI.
 */
export function ItemsCatalogView({
  errorMessage,
  isLoading = false,
  items,
  onRetry,
  organization,
  selectedLocationId,
}: ItemsCatalogViewProps) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const role = organization?.role?.toLowerCase() ?? "viewer";
  const canManage = writeRoles.has(role);
  const categories = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.categoryName).filter(isCategoryName))).sort(
        (a, b) => a.localeCompare(b),
      ),
    [items],
  );
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return items.filter((item) => {
      const lowStock = hasLowStock(item);
      const matchesQuery =
        !normalizedQuery ||
        item.sku.toLowerCase().includes(normalizedQuery) ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.categoryName?.toLowerCase().includes(normalizedQuery);
      const matchesCategory =
        categoryFilter === "all" ||
        (categoryFilter === "uncategorized"
          ? !item.categoryName
          : item.categoryName === categoryFilter);
      const matchesStock =
        stockFilter === "all" || (stockFilter === "low" ? lowStock : !lowStock);

      return matchesQuery && matchesCategory && matchesStock;
    });
  }, [categoryFilter, items, query, stockFilter]);
  const lowStockCount = items.filter(hasLowStock).length;
  const createHref = selectedLocationId
    ? `/dashboard/locations/${selectedLocationId}/inventory`
    : "/dashboard/locations";

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
              {organization?.name ?? "Organização selecionada"}
            </p>
            <h1 className="m-0 mt-1 text-2xl font-semibold tracking-normal">Catálogo de itens</h1>
            <p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-[#5c6670]">
              Busque produtos entre locais e abra o estoque do local para operações de estoque.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={canManage ? "secondary" : "outline"}>
              {canManage ? "Pode gerenciar itens" : "Acesso somente leitura"}
            </Badge>
            <Badge variant={lowStockCount ? "outline" : "secondary"}>{lowStockCount} estoque baixo</Badge>
          </div>
        </header>

        {!organization ? (
          <Alert variant="destructive">
            <AlertTitle>Nenhuma organização selecionada</AlertTitle>
            <AlertDescription>Selecione uma organização antes de navegar pelo catálogo de itens.</AlertDescription>
          </Alert>
        ) : null}

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>Não foi possível carregar os itens</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        {organization && !canManage ? (
          <Alert>
            <AlertTitle>Acesso de visualizador</AlertTitle>
            <AlertDescription>
              Visualizadores podem buscar disponibilidade de itens, mas não podem criar ou editar metadados de itens.
            </AlertDescription>
          </Alert>
        ) : null}

        {canManage ? (
          <Link
            className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-md bg-purple-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-600 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300"
            href={createHref}
          >
            <PackagePlus className="size-4" />
            Criar item no local
          </Link>
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
                <option key={category} value={category}>
                  {category}
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

        {!errorMessage && !items.length ? (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>Nenhum item ainda</CardTitle>
              <CardDescription>
                {canManage
                  ? "Crie itens pela página de estoque de um local para preencher o catálogo."
                  : "Nenhum item está disponível para esta organização ainda."}
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {!errorMessage && items.length > 0 && !filteredItems.length ? (
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle>Nenhum item encontrado</CardTitle>
              <CardDescription>Ajuste a busca ou os filtros para ampliar a lista do catálogo.</CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        {filteredItems.length ? (
          <div className="overflow-x-auto rounded-md border border-purple-100 bg-white">
            <table className="w-full min-w-[1040px] border-collapse text-left text-sm">
              <thead className="bg-purple-50 text-xs font-semibold text-purple-700">
                <tr>
                  <th className="px-3 py-3">SKU</th>
                  <th className="px-3 py-3">Nome</th>
                  <th className="px-3 py-3">Categoria</th>
                  <th className="px-3 py-3 text-right">Qtd. total</th>
                  <th className="px-3 py-3 text-right">Preço unitário</th>
                  <th className="px-3 py-3 text-right">Reposição</th>
                  <th className="px-3 py-3">Disponibilidade</th>
                  <th className="px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const lowStock = hasLowStock(item);

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
                      <td className="px-3 py-3">{item.categoryName ?? "Sem categoria"}</td>
                      <td
                        className={cn(
                          "px-3 py-3 text-right font-semibold",
                          lowStock ? "text-[#b42318]" : "text-[#16151c]",
                        )}
                      >
                        {item.totalQuantity}
                      </td>
                      <td className="px-3 py-3 text-right">{formatPrice(item.unitPrice)}</td>
                      <td className="px-3 py-3 text-right">{item.reorderPoint}</td>
                      <td className="px-3 py-3">
                        <div className="flex max-w-xs flex-wrap gap-1.5">
                          {item.locations.map((location) => (
                            <Link
                              className="inline-flex min-h-7 items-center gap-1 rounded-md border border-purple-200 bg-purple-50 px-2 text-xs font-semibold text-purple-700 hover:bg-purple-100"
                              href={location.inventoryHref}
                              key={location.locationId}
                            >
                              {location.locationName}: {location.quantity}
                              <ArrowRight className="size-3" />
                            </Link>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={lowStock ? "outline" : "secondary"}>
                          {lowStock ? "Estoque baixo" : "Saudável"}
                        </Badge>
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
            Mostrando {filteredItems.length} de {items.length} {items.length === 1 ? "item" : "itens"}
          </div>
        ) : null}
      </div>
    </main>
  );
}
