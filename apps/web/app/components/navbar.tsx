"use client";

import {
  Building2,
  LayoutDashboard,
  Lock,
  MapPin,
  Menu,
  PackageCheck,
  ReceiptText,
  Tags,
  Truck,
  type LucideIcon,
  Users,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "../lib/utils";

type NavbarOrganization = {
  name: string;
  role?: string | null;
};

type NavbarProps = {
  currentPath?: string;
  defaultMobileOpen?: boolean;
  organization?: NavbarOrganization | null;
  selectedLocationId?: string | null;
  selectedLocationName?: string | null;
};

type NavItem = {
  helper?: string;
  href: string;
  icon: LucideIcon;
  label: string;
  requiresActionRole?: boolean;
};

const actionRoles = new Set(["admin", "manager"]);

const dashboardNavItem = { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" };
const locationsNavItem = { icon: MapPin, label: "Locations", href: "/dashboard/locations" };
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
  selectedLocationId?: string | null,
  selectedLocationName?: string | null,
) => ({
  icon: PackageCheck,
  label: "Location Inventory",
  href: selectedLocationId
    ? `/dashboard/locations/${selectedLocationId}/inventory`
    : "/dashboard/locations",
  helper: selectedLocationName ?? "Select location first",
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
  organization,
  selectedLocationId,
  selectedLocationName,
}: NavbarProps) => {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(defaultMobileOpen);
  const activePath = currentPath ?? pathname;
  const role = organization?.role?.toLowerCase() ?? "viewer";
  const canUseActionWorkflows = actionRoles.has(role);
  const navItems: NavItem[] = [
    dashboardNavItem,
    locationsNavItem,
    getLocationInventoryItem(selectedLocationId, selectedLocationName),
    ...workflowNavItems,
  ];

  const navigation = (
    <>
      <div className="flex items-center gap-3 px-5 py-4">
        <Image src="/logo.svg" alt="estoque ai logo" width={112} height={48} priority />
      </div>

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
          href="/organizations/select?next=%2Fdashboard"
          className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-md border border-purple-200 bg-purple-50 px-3 text-xs font-semibold text-purple-700 transition-colors hover:bg-purple-100"
        >
          Switch organization
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map(({ helper, href, icon: Icon, label, requiresActionRole }) => {
          const isLocked = Boolean(requiresActionRole && !canUseActionWorkflows);
          const isActive = isActivePath(activePath, href);

          return (
            <Link
              aria-disabled={isLocked}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-r-md border-l-2 border-l-transparent px-4 py-2.5 text-[#16151c] transition-colors",
                "hover:border-l-purple-500 hover:bg-purple-500/10 hover:text-purple-600",
                isActive && "border-l-purple-500 bg-white text-purple-700 shadow-sm",
                isLocked && "pointer-events-none text-gray-400 hover:border-l-transparent hover:bg-transparent",
              )}
              href={isLocked ? activePath : href}
              key={label}
              onClick={() => setIsMobileOpen(false)}
            >
              <Icon className="size-4 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{label}</span>
                {helper ? <span className="block truncate text-xs text-gray-500">{helper}</span> : null}
              </span>
              {isLocked ? <Lock className="size-3.5 shrink-0" aria-label="Restricted" /> : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-purple-200 px-5 py-3 text-xs text-gray-500">
        Sales, adjustments, and transfers available in Phase 2.
      </div>
    </>
  );

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-purple-200 bg-white px-4 md:hidden">
        <Image src="/logo.svg" alt="estoque ai logo" width={104} height={44} priority />
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
