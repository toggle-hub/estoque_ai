"use client";

import { driver, type DriveStep, type Driver } from "driver.js";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FirstRunGuidanceStep } from "./first-run-guidance";

export const firstRunSpotlightTourStorageKey =
  "estoque_ai:first_run_spotlight_tour_dismissed_by_org";

export type SpotlightTargetType = "content" | "navigation";

type SpotlightTourStep = {
  description: string;
  targetId: string;
  targetType: SpotlightTargetType;
  title: string;
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
  catalog: "tour-nav-categories",
  location: "tour-nav-locations",
  receiving: "tour-nav-receiving",
} satisfies Record<FirstRunGuidanceStep, string>;

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
 * Builds the route-aware tour step for the current setup state.
 *
 * @param pathname Current route pathname.
 * @param currentStep Active first-run setup step.
 * @param canManage Whether the current role can complete setup actions.
 * @returns Tour step copy and target metadata.
 */
const getTourStep = (
  pathname: string,
  currentStep: FirstRunGuidanceStep,
  canManage: boolean,
): SpotlightTourStep => {
  if (isContentRoute(pathname, currentStep)) {
    return {
      description: canManage
        ? "Use este painel para acompanhar a sequência mínima de configuração sem perder o contexto da página."
        : "Este painel mostra o que ainda falta configurar. Seu acesso permite acompanhar e pesquisar, sem criar ou editar registros.",
      targetId: contentTargetId,
      targetType: "content",
      title: "Primeiros passos",
    };
  }

  const navigationCopy = {
    catalog:
      "Abra categorias para organizar o catálogo antes de cadastrar e receber estoque.",
    location:
      "Abra locais para cadastrar onde o estoque físico será controlado.",
    receiving:
      "Abra recebimento quando locais e catálogo estiverem prontos para entrada inicial de estoque.",
  } satisfies Record<FirstRunGuidanceStep, string>;

  return {
    description: canManage
      ? navigationCopy[currentStep]
      : "Este destino mostra a próxima área da configuração. Como viewer, você pode navegar e pesquisar sem editar.",
    targetId: navigationTargets[currentStep],
    targetType: "navigation",
    title: "Próximo destino",
  };
};

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
): DriveStep => ({
  disableActiveInteraction: false,
  element: targetSelector,
  popover: {
    description: tourStep.description,
    doneBtnText: "Pular tour",
    side: tourStep.targetType === "navigation" ? "right" : "bottom",
    title: tourStep.title,
  },
});

/**
 * Starts a single-step Driver.js tour against one DOM target.
 *
 * @param step Driver.js step configuration.
 * @param onDismiss Callback used when the user explicitly skips the tour.
 * @returns Driver instance.
 */
const startDriverTour = (step: DriveStep, onDismiss: () => void): Driver => {
  const driverInstance = driver({
    allowClose: true,
    allowKeyboardControl: true,
    animate: true,
    disableActiveInteraction: false,
    doneBtnText: "Pular tour",
    nextBtnText: "Pular tour",
    overlayClickBehavior: () => undefined,
    overlayColor: "#0f0f11",
    overlayOpacity: 0.7,
    popoverClass: "estoque-tour-popover",
    showButtons: ["next", "close"],
    smoothScroll: true,
    stagePadding: 8,
    stageRadius: 8,
    steps: [step],
    onCloseClick: (_element, _step, { driver: activeDriver }) => {
      onDismiss();
      activeDriver.destroy();
    },
    onNextClick: (_element, _step, { driver: activeDriver }) => {
      onDismiss();
      activeDriver.destroy();
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
      getDriverStep(targetSelector, {
        description,
        targetId: targetSelector,
        targetType,
        title,
      }),
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
  const tourStep = useMemo(
    () => getTourStep(pathname, currentStep, canManage),
    [canManage, currentStep, pathname],
  );
  const targetSelector = `[data-tour-target="${tourStep.targetId}"]`;

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

    const targetElement = document.querySelector(targetSelector);

    if (!targetElement) {
      return undefined;
    }

    const dismiss = () => {
      dismissTour(organizationId);
      setIsDismissed(true);
    };
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dismiss();
      }
    };

    driverRef.current?.destroy();
    driverRef.current = startDriverTour(
      getDriverStep(targetSelector, tourStep),
      dismiss,
    );
    window.addEventListener("keydown", dismissOnEscape);

    return () => {
      window.removeEventListener("keydown", dismissOnEscape);
      driverRef.current?.destroy();
      driverRef.current = null;
    };
  }, [isDismissed, organizationId, targetSelector, tourStep]);

  return null;
}
