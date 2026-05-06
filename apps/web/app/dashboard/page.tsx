"use client";

import { useQuery } from "@tanstack/react-query";
import { Navbar, type NavbarOrganization } from "../components/navbar";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import { getCurrentUser, getOrganizations } from "../lib/api";
import { getSelectedOrganizationId } from "../lib/organization-selection";

const getGreeting = () => {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

/**
 * Returns the organization selected for the current dashboard context.
 *
 * @returns Selected organization payload when available.
 */
const useSelectedOrganization = (): NavbarOrganization | undefined => {
  const organizationsQuery = useQuery({
    queryKey: ["organizations"],
    queryFn: getOrganizations,
    retry: false,
  });
  const selectedOrganizationId = getSelectedOrganizationId();

  return organizationsQuery.data?.find(
    (organization) => organization.id === selectedOrganizationId,
  );
};

/**
 * Renders the authenticated dashboard shell for the selected organization.
 *
 * @returns Dashboard page.
 */
const Dashboard = () => {
  const userQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: getCurrentUser,
    retry: false,
  });
  const selectedOrganization = useSelectedOrganization();
  const userName = userQuery.data?.name ?? "User";

  return (
    <div className="min-h-screen bg-gray-50 md:flex">
      <Navbar organization={selectedOrganization} />

      <div className="flex min-w-0 flex-1 flex-col pt-16 md:pt-0">
        {/* Topbar */}
        <header className="flex flex-col gap-4 border-b bg-white px-4 py-4 shadow-sm lg:flex-row lg:items-center lg:justify-between lg:px-6">
          {/* Greeting */}
          <div className="min-w-0">
            <h1 className="text-lg font-semibold">
              {getGreeting()}, {userName}
            </h1>
            <p className="text-sm text-gray-500">
              {selectedOrganization ? selectedOrganization.name : "Select an organization"}
            </p>
          </div>

          {/* Search */}
          <div className="w-full max-w-md lg:flex-1">
            <input
              type="text"
              placeholder="Search..."
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Profile */}
          <div className="flex items-center gap-3">
            <span className="min-w-0 truncate text-sm font-medium">{userName}</span>
            <Avatar>
              <AvatarFallback>{userName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
          </div>
        </header>

        <main className="p-6">{/* content */}</main>
      </div>
    </div>
  );
};

export default Dashboard;
