"use client";

import {
  Building2,
  Check,
  ChevronDown,
  LayoutDashboard,
  Lock,
  type LucideIcon,
  MapPin,
  Menu,
  PackageCheck,
  ReceiptText,
  Settings,
  Tags,
  Truck,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Location } from "../lib/api";
import { cn } from "../lib/utils";

export type NavbarOrganization = {
  name: string;
  role?: string | null;
};

type NavbarProps = {
  currentPath?: string;
  defaultMobileOpen?: boolean;
  hasLocationLoadError?: boolean;
  isLoadingLocations?: boolean;
  locations?: Location[];
  onSelectLocation?: (location: Location) => void;
  organization?: NavbarOrganization | null;
  selectedLocationId?: string | null;
  selectedLocationName?: string | null;
};

type NavItem = {
  helper?: string;
  href: string;
  icon: LucideIcon;
  isActive?: (currentPath: string) => boolean;
  label: string;
  opensLocationSelector?: boolean;
  requiresActionRole?: boolean;
};

const actionRoles = new Set(["admin", "manager"]);

const dashboardNavItem = { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" };
const locationsNavItem = {
  icon: MapPin,
  isActive: (currentPath: string) => currentPath === "/dashboard/locations",
  label: "Locations",
  href: "/dashboard/locations",
};
const organizationSettingsNavItem = {
  icon: Settings,
  label: "Organization Settings",
  href: "/dashboard/settings/organization",
};
const workflowNavItems: NavItem[] = [
  { icon: Tags, label: "Categories", href: "/dashboard/categories" },
  { icon: Users, label: "Customers", href: "/dashboard/customers" },
  { icon: Truck, label: "Receiving", href: "/dashboard/receiving", requiresActionRole: true },
  { icon: ReceiptText, label: "Transactions", href: "/dashboard/transactions" },
];

/**
 * Returns the selected-location inventory nav entry.
 *
 * @param selectedLocationId Selected location id.
 * @param selectedLocationName Selected location display name.
 * @returns Navigation metadata for location inventory.
 */
const getLocationInventoryItem = (
  hasSelectableLocations: boolean,
  selectedLocationId?: string | null,
  selectedLocationName?: string | null,
) => ({
  icon: PackageCheck,
  label: "Location Inventory",
  href: selectedLocationId
    ? `/dashboard/locations/${selectedLocationId}/inventory`
    : "/dashboard/locations",
  helper: selectedLocationName ?? "Select location first",
  isActive: (currentPath: string) =>
    currentPath.startsWith("/dashboard/locations/") && currentPath.includes("/inventory"),
  opensLocationSelector: !selectedLocationId && hasSelectableLocations,
});

/**
 * Checks whether a nav item should be marked active.
 *
 * @param currentPath Current route pathname.
 * @param href Navigation target.
 * @returns True when the target matches the current route.
 */
const isActivePath = (currentPath: string, href: string) =>
  currentPath === href || (href !== "/dashboard" && currentPath.startsWith(`${href}/`));

/**
 * Renders authenticated inventory navigation.
 *
 * @param props Navigation props.
 * @returns App navigation shell.
 */
export const Navbar = ({
  currentPath,
  defaultMobileOpen = false,
  hasLocationLoadError = false,
  isLoadingLocations = false,
  locations = [],
  onSelectLocation,
  organization,
  selectedLocationId,
  selectedLocationName,
}: NavbarProps) => {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(defaultMobileOpen);
  const [isLocationSelectorOpen, setIsLocationSelectorOpen] = useState(false);
  const activePath = currentPath ?? pathname;
  const role = organization?.role?.toLowerCase() ?? "viewer";
  const canUseActionWorkflows = actionRoles.has(role);
  const activeLocations = locations.filter((location) => location.is_active !== false);
  const hasSelectableLocations = activeLocations.length > 0 && !hasLocationLoadError;
  const navItems: NavItem[] = [
    dashboardNavItem,
    locationsNavItem,
    getLocationInventoryItem(hasSelectableLocations, selectedLocationId, selectedLocationName),
    organizationSettingsNavItem,
    ...workflowNavItems,
  ];
  const brand = (
    <Link href="/dashboard" className="inline-flex min-w-0 items-center gap-3">
      <span className="relative block h-9 w-[38px] shrink-0" aria-hidden="true">
        <span className="absolute top-px left-2 h-[21px] w-[21px] rotate-[30deg] skew-y-[-30deg] bg-purple-500" />
        <span className="absolute top-3.5 left-0.5 h-[21px] w-[21px] rotate-[30deg] skew-y-[-30deg] bg-purple-300" />
        <span className="absolute top-3.5 right-0.5 h-[21px] w-[21px] rotate-[30deg] skew-y-[-30deg] bg-purple-700" />
      </span>
      <span className="truncate text-lg leading-6 font-bold text-[#0f0f11]">estoque ai</span>
    </Link>
  );

  const navigation = (
    <>
      <div className="flex items-center gap-3 px-5 py-4">{brand}</div>

      <div className="mx-3 rounded-md border border-purple-200 bg-white px-3 py-3">
        <div className="flex min-w-0 items-start gap-2">
          <Building2 className="mt-0.5 size-4 shrink-0 text-purple-500" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[#16151c]">
              {organization?.name ?? "No organization selected"}
            </p>
            <p className="mt-0.5 text-xs font-medium capitalize text-gray-500">{role}</p>
          </div>
        </div>
        <Link
          href="/organizations/select?next=%2Fdashboard&mode=switch"
          className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md border border-purple-200 bg-purple-50 px-3 text-xs font-semibold text-purple-700 transition-colors hover:bg-purple-100"
        >
          Switch organization
        </Link>
      </div>

      <div className="mx-3 mt-3 rounded-md border border-purple-200 bg-white px-3 py-3">
        <p className="m-0 text-xs font-semibold text-purple-700">Active location</p>
        <button
          aria-expanded={isLocationSelectorOpen}
          className="mt-2 flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-purple-200 bg-purple-50 px-3 text-left text-sm font-semibold text-[#16151c] transition-colors hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={isLoadingLocations || hasLocationLoadError || !locations.length}
          onClick={() => setIsLocationSelectorOpen((open) => !open)}
          type="button"
        >
          <span className="truncate">
            {isLoadingLocations
              ? "Loading locations"
              : (selectedLocationName ?? (locations.length ? "Select location" : "No locations"))}
          </span>
          <ChevronDown className="size-4 shrink-0 text-purple-600" />
        </button>
        {hasLocationLoadError ? (
          <p className="m-0 mt-2 text-xs text-[#b42318]">Unable to load locations.</p>
        ) : null}
        {isLocationSelectorOpen ? (
          <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-purple-100 bg-white p-1">
            {locations.map((location) => {
              const isInactive = location.is_active === false;
              const isSelected = location.id === selectedLocationId;

              return (
                <button
                  className={cn(
                    "flex min-h-9 w-full min-w-0 items-center justify-between gap-2 rounded px-2 text-left text-sm transition-colors",
                    isInactive
                      ? "cursor-not-allowed text-gray-400"
                      : "text-[#16151c] hover:bg-purple-50",
                    isSelected && "bg-purple-100 text-purple-800",
                  )}
                  disabled={isInactive}
                  key={location.id}
                  onClick={() => {
                    onSelectLocation?.(location);
                    setIsLocationSelectorOpen(false);
                  }}
                  type="button"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{location.name}</span>
                    {isInactive ? <span className="block text-xs">Inactive</span> : null}
                  </span>
                  {isSelected ? <Check className="size-4 shrink-0" /> : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map(
          ({
            helper,
            href,
            icon: Icon,
            isActive: isItemActive,
            label,
            opensLocationSelector,
            requiresActionRole,
          }) => {
            const isLocked = Boolean(requiresActionRole && !canUseActionWorkflows);
            const isActive = isItemActive
              ? isItemActive(activePath)
              : isActivePath(activePath, href);

            if (opensLocationSelector) {
              return (
                <button
                  className="flex min-h-11 w-full items-center gap-3 rounded-r-md border-l-2 border-l-transparent px-4 py-2.5 text-left text-[#16151c] transition-colors hover:border-l-purple-500 hover:bg-purple-500/10 hover:text-purple-600"
                  key={label}
                  onClick={() => setIsLocationSelectorOpen(true)}
                  type="button"
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{label}</span>
                    {helper ? (
                      <span className="block truncate text-xs text-gray-500">{helper}</span>
                    ) : null}
                  </span>
                </button>
              );
            }

            return (
              <Link
                aria-disabled={isLocked}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-r-md border-l-2 border-l-transparent px-4 py-2.5 text-[#16151c] transition-colors",
                  "hover:border-l-purple-500 hover:bg-purple-500/10 hover:text-purple-600",
                  isActive && "border-l-purple-500 bg-white text-purple-700 shadow-sm",
                  isLocked &&
                    "pointer-events-none text-gray-400 hover:border-l-transparent hover:bg-transparent",
                )}
                href={isLocked ? activePath : href}
                key={label}
                onClick={() => setIsMobileOpen(false)}
                tabIndex={isLocked ? -1 : undefined}
              >
                <Icon className="size-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{label}</span>
                  {helper ? (
                    <span className="block truncate text-xs text-gray-500">{helper}</span>
                  ) : null}
                </span>
                {isLocked ? <Lock className="size-3.5 shrink-0" aria-label="Restricted" /> : null}
              </Link>
            );
          },
        )}
      </nav>

      <div className="border-t border-purple-200 px-5 py-3 text-xs text-gray-500">
        Sales, adjustments, and transfers available in Phase 2.
      </div>
    </>
  );

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-purple-200 bg-white px-4 md:hidden">
        {brand}
        <button
          aria-label={isMobileOpen ? "Close navigation" : "Open navigation"}
          className="inline-flex size-10 items-center justify-center rounded-md border border-purple-200 text-purple-700"
          onClick={() => setIsMobileOpen((open) => !open)}
          type="button"
        >
          {isMobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </header>

      {isMobileOpen ? (
        <button
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-40 bg-black/20 md:hidden"
          onClick={() => setIsMobileOpen(false)}
          type="button"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(19rem,calc(100vw-2rem))] flex-col bg-purple-100 shadow-xl transition-transform md:sticky md:top-0 md:z-auto md:h-screen md:w-72 md:translate-x-0 md:shadow-none",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {navigation}
      </aside>
    </>
  );
};
