"use client";

import Link from "next/link";
import { useState } from "react";
import type { Organization } from "../../lib/api";
import { Button } from "../ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";

export const firstRunGuidanceStorageKey = "estoque_ai:first_run_guidance_dismissed_by_org";

export type FirstRunGuidanceStep = "location" | "catalog" | "receiving";

type FirstRunGuidanceProps = {
  canManage: boolean;
  completedSteps?: FirstRunGuidanceStep[];
  currentStep: FirstRunGuidanceStep;
  forceVisible?: boolean;
  initialDismissed?: boolean;
  organization?: Organization | null;
};

const stepConfigs = {
  location: {
    actionHref: "/dashboard/locations",
    actionLabel: "Abrir locais",
    label: "Criar o primeiro local",
  },
  catalog: {
    actionHref: "/dashboard/categories",
    actionLabel: "Abrir catálogo",
    label: "Criar categorias e itens",
  },
  receiving: {
    actionHref: "/dashboard/receiving",
    actionLabel: "Abrir recebimento",
    label: "Receber o primeiro estoque",
  },
} satisfies Record<FirstRunGuidanceStep, {
  actionHref: string;
  actionLabel: string;
  label: string;
}>;

const orderedSteps: FirstRunGuidanceStep[] = ["location", "catalog", "receiving"];

/**
 * Reads the dismissed-guidance map from local storage.
 *
 * @returns Dismissal state keyed by organization id.
 */
const getDismissedOrganizations = () => {
  if (typeof window === "undefined") {
    return {};
  }

  const value = window.localStorage.getItem(firstRunGuidanceStorageKey);

  if (!value) {
    return {};
  }

  try {
    return JSON.parse(value) as Record<string, boolean>;
  } catch {
    window.localStorage.removeItem(firstRunGuidanceStorageKey);
    return {};
  }
};

/**
 * Persists guidance dismissal for one organization.
 *
 * @param organizationId Organization that dismissed the helper.
 */
const dismissGuidance = (organizationId: string) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    firstRunGuidanceStorageKey,
    JSON.stringify({
      ...getDismissedOrganizations(),
      [organizationId]: true,
    }),
  );
};

/**
 * Renders compact, dismissible first-run guidance for operational empty states.
 *
 * @param props First-run guidance props.
 * @returns Guidance card or `null` when dismissed or unavailable.
 */
export function FirstRunGuidance({
  canManage,
  completedSteps = [],
  currentStep,
  forceVisible = false,
  initialDismissed = false,
  organization,
}: FirstRunGuidanceProps) {
  const organizationId = organization?.id;
  const [isDismissed, setIsDismissed] = useState(() =>
    initialDismissed || (organizationId ? Boolean(getDismissedOrganizations()[organizationId]) : false),
  );

  if (!organization || (!forceVisible && isDismissed)) {
    return null;
  }

  const currentStepConfig = stepConfigs[currentStep];

  return (
    <Card className="border-purple-200 bg-purple-50/50">
      <CardHeader className="gap-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-base">Primeiros passos</CardTitle>
            <CardDescription className="mt-1">
              {canManage
                ? "Siga a sequência operacional mínima para começar a movimentar estoque."
                : "Sua organização ainda está em configuração. Acompanhe a sequência enquanto um gestor conclui os passos."}
            </CardDescription>
          </div>
          <Button
            onClick={() => {
              if (organizationId) {
                dismissGuidance(organizationId);
              }

              setIsDismissed(true);
            }}
            type="button"
            variant="outline"
          >
            Ocultar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ol className="grid gap-2 text-sm text-[#16151c] md:grid-cols-3">
          {orderedSteps.map((step) => {
            const isComplete = completedSteps.includes(step);
            const isCurrent = step === currentStep;

            return (
              <li
                className={
                  isCurrent
                    ? "rounded-md border border-purple-200 bg-white p-3"
                    : "rounded-md border border-purple-100 bg-white/80 p-3"
                }
                key={step}
              >
                <p className="m-0 text-xs font-semibold text-purple-700">
                  {isComplete ? "Concluído" : isCurrent ? "Agora" : "Depois"}
                </p>
                <p className="m-0 mt-1 font-medium">{stepConfigs[step].label}</p>
              </li>
            );
          })}
        </ol>
        {canManage ? (
          <Link
            className="inline-flex h-10 w-fit items-center justify-center rounded-md bg-purple-500 px-4 text-sm font-medium text-white transition-colors hover:bg-purple-600"
            href={currentStepConfig.actionHref}
          >
            {currentStepConfig.actionLabel}
          </Link>
        ) : null}
      </CardContent>
    </Card>
  );
}
