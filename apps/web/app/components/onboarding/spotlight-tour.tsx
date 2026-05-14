"use client";

import { driver, type DriveStep, type Driver } from "driver.js";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FirstRunGuidanceStep } from "./first-run-guidance";

export const firstRunSpotlightTourStorageKey =
  "estoque_ai:first_run_spotlight_tour_dismissed_by_org";

export type SpotlightTargetType = "content" | "navigation";

type SpotlightTourStep = {
  actionHref?: string;
  description: string;
  targetId: string;
  targetType: SpotlightTargetType;
  title: string;
};

type DriverTourStep = DriveStep & {
  actionHref?: string;
};

type FirstRunSpotlightTourProps = {
  canManage: boolean;
  currentStep: FirstRunGuidanceStep;
  organizationId?: string | null;
};

type DriverSpotlightPreviewProps = {
  description: string;
  isDismissed?: boolean;
  targetSelector: string;
  targetType: SpotlightTargetType;
  title: string;
};

const contentTargetId = "first-run-guidance";

const navigationTargets = {
  categories: "tour-nav-categories",
  items: "tour-nav-items",
  location: "tour-nav-locations",
  receiving: "tour-nav-receiving",
} as const;

const navigationTourSteps = {
  location: [
    {
      actionHref: "/dashboard/locations",
      managerDescription:
        "Abra locais para cadastrar onde o estoque físico será controlado.",
      requiresActionRole: false,
      targetId: navigationTargets.location,
      title: "Cadastre um local",
      viewerDescription:
        "Locais mostram onde o estoque físico será controlado. Como viewer, você pode navegar e pesquisar sem editar.",
    },
  ],
  catalog: [
    {
      actionHref: "/dashboard/categories",
      managerDescription:
        "Abra categorias para organizar os grupos do catálogo antes de cadastrar produtos.",
      requiresActionRole: false,
      targetId: navigationTargets.categories,
      title: "Organize categorias",
      viewerDescription:
        "Categorias organizam os grupos do catálogo. Como viewer, você pode acompanhar a configuração sem editar.",
    },
    {
      actionHref: "/dashboard/items",
      managerDescription:
        "Depois cadastre itens com SKU, preço e ponto de reposição para liberar o recebimento.",
      requiresActionRole: false,
      targetId: navigationTargets.items,
      title: "Cadastre itens",
      viewerDescription:
        "Itens concentram SKU, preço e ponto de reposição. Como viewer, você pode consultar os cadastros existentes.",
    },
  ],
  receiving: [
    {
      actionHref: "/dashboard/receiving",
      managerDescription:
        "Abra recebimento quando locais e catálogo estiverem prontos para entrada inicial de estoque.",
      requiresActionRole: true,
      targetId: navigationTargets.receiving,
      title: "Receba estoque",
      viewerDescription:
        "Recebimento registra entradas de estoque. Como viewer, você pode acompanhar o fluxo sem criar movimentações.",
    },
  ],
} satisfies Record<
  FirstRunGuidanceStep,
  {
    actionHref: string;
    managerDescription: string;
    requiresActionRole?: boolean;
    targetId: string;
    title: string;
    viewerDescription: string;
  }[]
>;

/**
 * Checks whether a parsed value is a persisted tour dismissal map.
 *
 * @param value Parsed local-storage value.
 * @returns Whether the value can be used as a dismissal map.
 */
const isDismissedOrganizationMap = (
  value: unknown,
): value is Record<string, boolean> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.entries(value).every(
    ([organizationId, isDismissed]) =>
      typeof organizationId === "string" && typeof isDismissed === "boolean",
  );

/**
 * Removes invalid spotlight-tour storage when possible.
 */
const clearDismissedOrganizations = () => {
  try {
    window.localStorage.removeItem(firstRunSpotlightTourStorageKey);
  } catch {
    return;
  }
};

/**
 * Reads dismissed spotlight-tour organizations from local storage.
 *
 * @returns Dismissal state keyed by organization id.
 */
const getDismissedOrganizations = () => {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const value = window.localStorage.getItem(firstRunSpotlightTourStorageKey);

    if (!value) {
      return {};
    }

    const parsedValue = JSON.parse(value) as unknown;

    if (!isDismissedOrganizationMap(parsedValue)) {
      clearDismissedOrganizations();
      return {};
    }

    return parsedValue;
  } catch {
    clearDismissedOrganizations();
    return {};
  }
};

/**
 * Persists spotlight-tour dismissal for one organization.
 *
 * @param organizationId Organization that skipped the tour.
 */
const dismissTour = (organizationId: string) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      firstRunSpotlightTourStorageKey,
      JSON.stringify({
        ...getDismissedOrganizations(),
        [organizationId]: true,
      }),
    );
  } catch {
    return;
  }
};

/**
 * Returns true when the current route already contains the active guidance content.
 *
 * @param pathname Current route pathname.
 * @param currentStep Active first-run setup step.
 * @returns Whether the tour should target the content card.
 */
const isContentRoute = (
  pathname: string,
  currentStep: FirstRunGuidanceStep,
) => {
  if (currentStep === "location") {
    return pathname === "/dashboard/locations";
  }

  if (currentStep === "catalog") {
    return (
      pathname === "/dashboard/categories" ||
      pathname === "/dashboard/items" ||
      (pathname.startsWith("/dashboard/locations/") &&
        pathname.endsWith("/inventory"))
    );
  }

  return pathname === "/dashboard/receiving";
};

/**
 * Returns true when the current route can render the guidance card target.
 *
 * @param pathname Current route pathname.
 * @param currentStep Active first-run setup step.
 * @returns Whether the tour can include the guidance content step.
 */
const canIncludeContentStep = (
  pathname: string,
  currentStep: FirstRunGuidanceStep,
) => pathname === "/dashboard" || isContentRoute(pathname, currentStep);

/**
 * Builds the guidance-card tour step.
 *
 * @param canManage Whether the current role can complete setup actions.
 * @returns Tour step copy and target metadata for the guidance card.
 */
const getContentTourStep = (canManage: boolean): SpotlightTourStep => ({
  description: canManage
    ? "Use este painel para acompanhar a sequência mínima de configuração sem perder o contexto da página."
    : "Este painel mostra o que ainda falta configurar. Seu acesso permite acompanhar e pesquisar, sem criar ou editar registros.",
  targetId: contentTargetId,
  targetType: "content",
  title: "Primeiros passos",
});

/**
 * Builds the full navigation tour sequence.
 *
 * @param canManage Whether the current role can complete setup actions.
 * @returns Ordered navigation tour steps for the first-run setup path.
 */
const getNavigationTourSteps = (
  canManage: boolean,
): SpotlightTourStep[] =>
  (["location", "catalog", "receiving"] as const).flatMap((stepKey) =>
    navigationTourSteps[stepKey].map((step) => ({
      actionHref:
        !step.requiresActionRole || canManage ? step.actionHref : undefined,
      description: canManage
        ? step.managerDescription
        : step.viewerDescription,
      targetId: step.targetId,
      targetType: "navigation",
      title: step.title,
    })),
  );

/**
 * Builds route-aware tour steps for the current setup state.
 *
 * @param pathname Current route pathname.
 * @param currentStep Active first-run setup step.
 * @param canManage Whether the current role can complete setup actions.
 * @returns Ordered tour steps for visible content and next destinations.
 */
const getTourSteps = (
  pathname: string,
  currentStep: FirstRunGuidanceStep,
  canManage: boolean,
): SpotlightTourStep[] => [
  ...(canIncludeContentStep(pathname, currentStep)
    ? [getContentTourStep(canManage)]
    : []),
  ...getNavigationTourSteps(canManage),
];

/**
 * Builds one Driver.js step for the selected target.
 *
 * @param targetSelector CSS selector for the highlighted target.
 * @param tourStep Route-aware tour step copy.
 * @returns Driver.js step configuration.
 */
const getDriverStep = (
  targetSelector: string,
  tourStep: SpotlightTourStep,
): DriverTourStep => ({
  actionHref: tourStep.actionHref,
  disableActiveInteraction: false,
  element: targetSelector,
  popover: {
    description: tourStep.description,
    doneBtnText: "Concluir",
    side: tourStep.targetType === "navigation" ? "right" : "bottom",
    title: tourStep.title,
  },
});

/**
 * Builds Driver.js steps for targets that exist in the current DOM.
 *
 * @param tourSteps Candidate tour steps for the current route.
 * @returns Driver.js steps that can be highlighted now.
 */
const getAvailableDriverSteps = (tourSteps: SpotlightTourStep[]) =>
  tourSteps.flatMap((tourStep) => {
    const targetSelector = `[data-tour-target="${tourStep.targetId}"]`;

    return document.querySelector(targetSelector)
      ? [getDriverStep(targetSelector, tourStep)]
      : [];
  });

/**
 * Starts a Driver.js tour against available DOM targets.
 *
 * @param steps Driver.js step configurations.
 * @param onDismiss Callback used when the user explicitly skips the tour.
 * @returns Driver instance.
 */
const startDriverTour = (
  steps: DriverTourStep[],
  onDismiss: () => void,
): Driver => {
  const driverInstance = driver({
    allowClose: true,
    allowKeyboardControl: true,
    animate: true,
    disableActiveInteraction: false,
    doneBtnText: "Concluir",
    nextBtnText: "Próximo",
    overlayClickBehavior: () => undefined,
    overlayColor: "#0f0f11",
    overlayOpacity: 0.7,
    popoverClass: "estoque-tour-popover",
    prevBtnText: "Voltar",
    progressText: "{{current}} de {{total}}",
    showButtons: ["previous", "next", "close"],
    showProgress: steps.length > 1,
    smoothScroll: true,
    stagePadding: 8,
    stageRadius: 8,
    steps,
    onCloseClick: (_element, _step, { driver: activeDriver }) => {
      onDismiss();
      activeDriver.destroy();
    },
    onDestroyStarted: (_element, _step, { driver: activeDriver }) => {
      onDismiss();
      activeDriver.destroy();
    },
    onNextClick: (_element, _step, { driver: activeDriver }) => {
      if (activeDriver.hasNextStep()) {
        activeDriver.moveNext();
        return;
      }

      onDismiss();
      activeDriver.destroy();
    },
    onPrevClick: (_element, _step, { driver: activeDriver }) => {
      activeDriver.movePrevious();
    },
  });

  driverInstance.drive();

  return driverInstance;
};

/**
 * Runs a Driver.js spotlight preview for Storybook.
 *
 * @param props Preview props.
 * @returns Null because Driver.js owns the overlay DOM.
 */
export function DriverSpotlightPreview({
  description,
  isDismissed = false,
  targetSelector,
  targetType,
  title,
}: DriverSpotlightPreviewProps) {
  useEffect(() => {
    if (isDismissed) {
      return undefined;
    }

    const targetElement = document.querySelector(targetSelector);

    if (!targetElement) {
      return undefined;
    }

    const driverInstance = startDriverTour(
      [
        getDriverStep(targetSelector, {
          description,
          targetId: targetSelector,
          targetType,
          title,
        }),
      ],
      () => undefined,
    );

    return () => driverInstance.destroy();
  }, [description, isDismissed, targetSelector, targetType, title]);

  return null;
}

/**
 * Runs the route-aware first-run spotlight tour with Driver.js.
 *
 * @param props First-run spotlight tour props.
 * @returns Null because Driver.js owns the overlay DOM.
 */
export function FirstRunSpotlightTour({
  canManage,
  currentStep,
  organizationId,
}: FirstRunSpotlightTourProps) {
  const pathname = usePathname();
  const driverRef = useRef<Driver | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const tourSteps = useMemo(
    () => getTourSteps(pathname, currentStep, canManage),
    [canManage, currentStep, pathname],
  );

  useEffect(() => {
    setIsDismissed(
      organizationId
        ? Boolean(getDismissedOrganizations()[organizationId])
        : false,
    );
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId || isDismissed) {
      return undefined;
    }

    const driverSteps = getAvailableDriverSteps(tourSteps);

    if (!driverSteps.length) {
      return undefined;
    }

    const dismiss = () => {
      dismissTour(organizationId);
      setIsDismissed(true);
    };

    driverRef.current?.destroy();
    driverRef.current = startDriverTour(driverSteps, dismiss);

    return () => {
      driverRef.current?.destroy();
      driverRef.current = null;
    };
  }, [isDismissed, organizationId, tourSteps]);

  return null;
}
