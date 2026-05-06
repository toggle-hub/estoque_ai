import type { ReactNode } from "react";
import { AuthGuard } from "../components/auth/auth-guard";
import { OrganizationGuard } from "../components/organizations/organization-guard";

type DashboardLayoutProps = {
  children: ReactNode;
};

/**
 * Protects dashboard routes behind an authenticated session check.
 *
 * @param props Layout props.
 * @returns Protected dashboard route tree.
 */
export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <AuthGuard>
      <OrganizationGuard>{children}</OrganizationGuard>
    </AuthGuard>
  );
}
