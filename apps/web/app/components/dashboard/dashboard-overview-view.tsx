"use client";

import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  CircleDollarSign,
  Package,
  RotateCw,
  TriangleAlert,
} from "lucide-react";
import type { Organization } from "../../lib/api";
import { cn } from "../../lib/utils";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Spinner } from "../ui/spinner";

export type DashboardOverviewMetrics = {
  inventoryValue: number;
  lowStockItems: number;
  totalSkus: number;
  totalStockUnits: number;
};

export type DashboardActivity = {
  id: string;
  itemName: string;
  locationName: string | null;
  occurredAt: string;
  quantity: number;
  sku: string | null;
  type: "RECEIVING" | "SALE";
};

type MetricCardConfig = {
  description: string;
  icon: typeof Package;
  tone: "default" | "warning";
  title: string;
  value: string;
};

export type DashboardOverviewViewProps = {
  activities: DashboardActivity[];
  errorMessage?: string;
  isLoading?: boolean;
  metrics?: DashboardOverviewMetrics;
  onRetry?: () => void;
  organization?: Organization | null;
};

const numberFormatter = new Intl.NumberFormat("pt-BR");

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  currency: "BRL",
  maximumFractionDigits: 2,
  style: "currency",
});

const activityDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
});

const activityLabels = {
  RECEIVING: {
    icon: ArrowDownLeft,
    label: "Recebimento",
    quantityClassName: "text-purple-600",
  },
  SALE: {
    icon: ArrowUpRight,
    label: "Venda",
    quantityClassName: "text-purple-700",
  },
} satisfies Record<DashboardActivity["type"], {
  icon: typeof ArrowDownLeft;
  label: string;
  quantityClassName: string;
}>;

/**
 * Formats an integer metric using Brazilian separators.
 *
 * @param value Numeric metric value.
 * @returns Localized integer string.
 */
const formatNumber = (value: number) => numberFormatter.format(value);

/**
 * Formats money values for dashboard metric cards.
 *
 * @param value BRL value.
 * @returns Localized currency string.
 */
const formatCurrency = (value: number) => currencyFormatter.format(value);

/**
 * Formats activity timestamps for compact dashboard rows.
 *
 * @param value ISO timestamp.
 * @returns Localized date and time string.
 */
const formatActivityDate = (value: string) =>
  activityDateFormatter.format(new Date(value));

/**
 * Builds the metric card configuration shown in the overview grid.
 *
 * @param metrics Aggregated dashboard metrics.
 * @returns Metric card metadata.
 */
const getMetricCards = (metrics: DashboardOverviewMetrics): MetricCardConfig[] => [
  {
    description: "Produtos ativos no estoque",
    icon: Package,
    title: "SKUs totais",
    tone: "default",
    value: formatNumber(metrics.totalSkus),
  },
  {
    description: "Soma entre todos os locais",
    icon: Boxes,
    title: "Unidades em estoque",
    tone: "default",
    value: formatNumber(metrics.totalStockUnits),
  },
  {
    description: "Itens no ponto de reposição",
    icon: TriangleAlert,
    title: "Estoque baixo",
    tone: metrics.lowStockItems > 0 ? "warning" : "default",
    value: formatNumber(metrics.lowStockItems),
  },
  {
    description: "Quantidade vezes preço unitário",
    icon: CircleDollarSign,
    title: "Valor do estoque",
    tone: "default",
    value: formatCurrency(metrics.inventoryValue),
  },
];

/**
 * Renders the operational dashboard overview content.
 *
 * @param props Dashboard overview props.
 * @returns Dashboard overview UI.
 */
export function DashboardOverviewView({
  activities,
  errorMessage,
  isLoading = false,
  metrics,
  onRetry,
  organization,
}: DashboardOverviewViewProps) {
  if (isLoading) {
    return (
      <main className="grid min-h-[calc(100svh-4rem)] place-items-center bg-white p-6 md:min-h-screen">
        <Spinner />
      </main>
    );
  }

  const hasInventory = Boolean(metrics && (metrics.totalSkus > 0 || metrics.totalStockUnits > 0));
  const metricCards = getMetricCards(
    metrics ?? {
      inventoryValue: 0,
      lowStockItems: 0,
      totalSkus: 0,
      totalStockUnits: 0,
    },
  );

  return (
    <main className="min-h-[calc(100svh-4rem)] bg-white p-4 text-[#16151c] md:min-h-screen md:p-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-purple-100 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="m-0 text-sm font-medium text-purple-600">
              {organization?.name ?? "Organização selecionada"}
            </p>
            <h1 className="m-0 mt-1 text-2xl font-semibold tracking-normal">Painel operacional</h1>
            <p className="m-0 mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Acompanhe volume, valor e riscos de reposição do estoque.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={metrics?.lowStockItems ? "outline" : "secondary"}>
              {formatNumber(metrics?.lowStockItems ?? 0)} estoque baixo
            </Badge>
            <Badge variant="secondary">{formatNumber(activities.length)} atividades recentes</Badge>
          </div>
        </header>

        {!organization ? (
          <Alert variant="destructive">
            <AlertTitle>Nenhuma organização selecionada</AlertTitle>
            <AlertDescription>Selecione uma organização para visualizar as métricas do painel.</AlertDescription>
          </Alert>
        ) : null}

        {errorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>Não foi possível carregar o painel</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
            {onRetry ? (
              <Button className="mt-3" onClick={onRetry} variant="outline">
                <RotateCw />
                Tentar novamente
              </Button>
            ) : null}
          </Alert>
        ) : null}

        {organization ? (
          <>
            {!errorMessage && !hasInventory ? (
              <Alert>
                <AlertTitle>Estoque ainda vazio</AlertTitle>
                <AlertDescription>
                  Cadastre itens e registre recebimentos para preencher os indicadores operacionais.
                </AlertDescription>
              </Alert>
            ) : null}

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {metricCards.map((metric) => {
                const Icon = metric.icon;

                return (
                  <Card
                    className={cn(
                      "min-h-36",
                      metric.tone === "warning" ? "border-purple-200 bg-purple-50" : undefined,
                    )}
                    key={metric.title}
                  >
                    <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
                      <div className="min-w-0">
                        <CardDescription>{metric.title}</CardDescription>
                        <CardTitle className="mt-2 truncate text-2xl">{metric.value}</CardTitle>
                      </div>
                      <span
                        className={cn(
                          "grid size-10 shrink-0 place-items-center rounded-md bg-purple-100 text-purple-700",
                          metric.tone === "warning" ? "bg-purple-500 text-white" : undefined,
                        )}
                      >
                        <Icon className="size-5" />
                      </span>
                    </CardHeader>
                    <CardContent>
                      <p className="m-0 text-sm leading-6 text-gray-500">{metric.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
              <Card>
                <CardHeader>
                  <CardTitle>Atividade recente</CardTitle>
                  <CardDescription>Últimos recebimentos e vendas registrados.</CardDescription>
                </CardHeader>
                <CardContent>
                  {activities.length ? (
                    <div className="divide-y divide-purple-100">
                      {activities.map((activity) => {
                        const activityType = activityLabels[activity.type];
                        const ActivityIcon = activityType.icon;

                        return (
                          <div className="flex min-w-0 items-center gap-3 py-3" key={activity.id}>
                            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-purple-100 text-purple-700">
                              <ActivityIcon className="size-4" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                <p className="m-0 truncate text-sm font-semibold">{activity.itemName}</p>
                                <Badge variant="outline">{activityType.label}</Badge>
                              </div>
                              <p className="m-0 mt-1 truncate text-xs text-gray-500">
                                {activity.sku ?? "Sem SKU"} · {activity.locationName ?? "Local desconhecido"} ·{" "}
                                {formatActivityDate(activity.occurredAt)}
                              </p>
                            </div>
                            <span className={cn("shrink-0 text-sm font-semibold", activityType.quantityClassName)}>
                              {activity.type === "SALE" ? "-" : "+"}
                              {formatNumber(activity.quantity)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-md border border-dashed border-purple-200 p-6 text-center">
                      <AlertCircle className="size-8 text-purple-500" />
                      <div>
                        <p className="m-0 text-sm font-semibold">Nenhuma movimentação recente</p>
                        <p className="m-0 mt-1 text-sm leading-6 text-gray-500">
                          Recebimentos e vendas aparecerão aqui quando estiverem disponíveis.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Reposição</CardTitle>
                  <CardDescription>Prioridade operacional para o dia.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border border-purple-100 bg-purple-50 p-4">
                    <p className="m-0 text-3xl font-semibold text-purple-700">
                      {formatNumber(metrics?.lowStockItems ?? 0)}
                    </p>
                    <p className="m-0 mt-2 text-sm leading-6 text-gray-500">
                      {metrics?.lowStockItems
                        ? "Revise os itens abaixo do ponto de reposição antes das próximas vendas."
                        : "Nenhum item está abaixo do ponto de reposição no momento."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
