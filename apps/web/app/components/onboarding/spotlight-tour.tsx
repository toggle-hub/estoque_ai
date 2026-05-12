"use client";

import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Button } from "../ui/button";
import type { FirstRunGuidanceStep } from "./first-run-guidance";

export const firstRunSpotlightTourStorageKey =
  "estoque_ai:first_run_spotlight_tour_dismissed_by_org";

export type SpotlightTargetType = "content" | "navigation";

type SpotlightRect = {
  height: number;
  left: number;
  top: number;
  width: number;
};

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

type SpotlightTourOverlayProps = {
  isDismissed?: boolean;
  onDismiss?: () => void;
  targetRect: SpotlightRect;
  targetType: SpotlightTargetType;
  title: string;
  description: string;
};

const contentTargetId = "first-run-guidance";
const tourPadding = 8;

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
 * Converts a DOMRect into the serializable rectangle used by the overlay.
 *
 * @param rect DOM bounding rectangle.
 * @returns Plain spotlight rectangle.
 */
const toSpotlightRect = (rect: DOMRect): SpotlightRect => ({
  height: rect.height,
  left: rect.left,
  top: rect.top,
  width: rect.width,
});

/**
 * Calculates the overlay panel placement near the highlighted target.
 *
 * @param targetRect Target rectangle.
 * @returns Fixed-position style for the guidance panel.
 */
const getPanelStyle = (targetRect: SpotlightRect): CSSProperties => {
  if (typeof window === "undefined" || window.innerWidth < 640) {
    return {
      bottom: 16,
      left: 16,
      right: 16,
    };
  }

  const width = 352;
  const left = Math.min(
    Math.max(targetRect.left, 16),
    Math.max(window.innerWidth - width - 16, 16),
  );
  const hasRoomBelow =
    targetRect.top + targetRect.height + 16 + 220 < window.innerHeight;

  return {
    left,
    top: hasRoomBelow
      ? targetRect.top + targetRect.height + 16
      : Math.max(targetRect.top - 236, 16),
    width,
  };
};

/**
 * Renders the dimming layers and guidance panel around a measured target.
 *
 * @param props Spotlight overlay props.
 * @returns Spotlight overlay or `null` when dismissed.
 */
export function SpotlightTourOverlay({
  description,
  isDismissed = false,
  onDismiss,
  targetRect,
  targetType,
  title,
}: SpotlightTourOverlayProps) {
  if (isDismissed) {
    return null;
  }

  const cutTop = Math.max(targetRect.top - tourPadding, 0);
  const cutLeft = Math.max(targetRect.left - tourPadding, 0);
  const cutWidth = targetRect.width + tourPadding * 2;
  const cutHeight = targetRect.height + tourPadding * 2;
  const panelStyle = getPanelStyle(targetRect);

  return (
    <>
      <div
        className="fixed inset-x-0 top-0 z-[60] bg-[#0f0f11]/70"
        style={{ height: cutTop }}
      />
      <div
        className="fixed z-[60] bg-[#0f0f11]/70"
        style={{ height: cutHeight, left: 0, top: cutTop, width: cutLeft }}
      />
      <div
        className="fixed z-[60] bg-[#0f0f11]/70"
        style={{
          height: cutHeight,
          left: cutLeft + cutWidth,
          right: 0,
          top: cutTop,
        }}
      />
      <div
        className="fixed inset-x-0 bottom-0 z-[60] bg-[#0f0f11]/70"
        style={{ top: cutTop + cutHeight }}
      />
      <section
        aria-labelledby="first-run-spotlight-title"
        className="fixed z-[80] rounded-md border border-purple-200 bg-white p-4 text-[#16151c] shadow-2xl"
        role="dialog"
        style={panelStyle}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="m-0 text-xs font-semibold uppercase text-purple-700">
              {targetType === "navigation" ? "Navegação" : "Configuração"}
            </p>
            <h2
              id="first-run-spotlight-title"
              className="m-0 mt-1 text-base font-semibold"
            >
              {title}
            </h2>
          </div>
          <button
            aria-label="Pular tour"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-purple-50 hover:text-purple-700"
            onClick={onDismiss}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>
        <p className="m-0 mt-2 text-sm leading-6 text-gray-600">
          {description}
        </p>
        <div className="mt-4 flex justify-end">
          <Button onClick={onDismiss} type="button" variant="outline">
            Pular tour
          </Button>
        </div>
      </section>
    </>
  );
}

/**
 * Runs the route-aware first-run spotlight tour.
 *
 * @param props First-run spotlight tour props.
 * @returns Spotlight tour overlay or `null` when unavailable.
 */
export function FirstRunSpotlightTour({
  canManage,
  currentStep,
  organizationId,
}: FirstRunSpotlightTourProps) {
  const pathname = usePathname();
  const [isDismissed, setIsDismissed] = useState(false);
  const [targetRect, setTargetRect] = useState<SpotlightRect | null>(null);
  const tourStep = useMemo(
    () => getTourStep(pathname, currentStep, canManage),
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
    if (isDismissed) {
      return undefined;
    }

    let targetElement: HTMLElement | null = null;
    let originalPosition = "";
    let originalZIndex = "";
    let originalBoxShadow = "";
    let originalBorderRadius = "";

    const updateTargetRect = () => {
      targetElement = document.querySelector<HTMLElement>(
        `[data-tour-target="${tourStep.targetId}"]`,
      );

      if (!targetElement) {
        setTargetRect(null);
        return;
      }

      const rect = targetElement.getBoundingClientRect();

      if (rect.width <= 0 || rect.height <= 0) {
        setTargetRect(null);
        return;
      }

      setTargetRect(toSpotlightRect(rect));
    };

    updateTargetRect();
    targetElement = document.querySelector<HTMLElement>(
      `[data-tour-target="${tourStep.targetId}"]`,
    );

    if (targetElement) {
      originalPosition = targetElement.style.position;
      originalZIndex = targetElement.style.zIndex;
      originalBoxShadow = targetElement.style.boxShadow;
      originalBorderRadius = targetElement.style.borderRadius;

      if (window.getComputedStyle(targetElement).position === "static") {
        targetElement.style.position = "relative";
      }

      targetElement.style.zIndex = "70";
      targetElement.style.boxShadow = "0 0 0 4px rgba(147, 51, 234, 0.28)";
      targetElement.style.borderRadius =
        targetElement.style.borderRadius || "0.5rem";
    }

    window.addEventListener("resize", updateTargetRect);
    window.addEventListener("scroll", updateTargetRect, true);

    return () => {
      window.removeEventListener("resize", updateTargetRect);
      window.removeEventListener("scroll", updateTargetRect, true);

      if (targetElement) {
        targetElement.style.position = originalPosition;
        targetElement.style.zIndex = originalZIndex;
        targetElement.style.boxShadow = originalBoxShadow;
        targetElement.style.borderRadius = originalBorderRadius;
      }
    };
  }, [isDismissed, tourStep.targetId]);

  useEffect(() => {
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (organizationId) {
          dismissTour(organizationId);
        }

        setIsDismissed(true);
      }
    };

    window.addEventListener("keydown", dismissOnEscape);

    return () => window.removeEventListener("keydown", dismissOnEscape);
  }, [organizationId]);

  if (!organizationId || isDismissed || !targetRect) {
    return null;
  }

  return (
    <SpotlightTourOverlay
      description={tourStep.description}
      onDismiss={() => {
        dismissTour(organizationId);
        setIsDismissed(true);
      }}
      targetRect={targetRect}
      targetType={tourStep.targetType}
      title={tourStep.title}
    />
  );
}
