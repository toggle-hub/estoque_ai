import type { Meta, StoryObj } from "@storybook/nextjs";
import { Navbar } from "../app/components/navbar";
import type { Location } from "../app/lib/api";

const locations: Location[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    organization_id: "00000000-0000-4000-8000-000000000010",
    name: "Sao Paulo Warehouse",
    address: "Rua A, 100",
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    organization_id: "00000000-0000-4000-8000-000000000010",
    name: "Inactive Store",
    address: "Rua B, 200",
    is_active: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
  },
];

const meta = {
  title: "Components/Navbar",
  component: Navbar,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof Navbar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    currentPath: "/dashboard",
  },
};

export const SelectedOrganization: Story = {
  args: {
    currentPath: "/dashboard/transactions",
    organization: {
      name: "Ada Industries",
      role: "admin",
    },
    selectedLocationId: "00000000-0000-4000-8000-000000000001",
    selectedLocationName: "Sao Paulo Warehouse",
    locations,
  },
};

export const NeedsLocationSelection: Story = {
  args: {
    currentPath: "/dashboard",
    locations,
    organization: {
      name: "Ada Industries",
      role: "manager",
    },
  },
};

export const LoadingLocations: Story = {
  args: {
    currentPath: "/dashboard",
    isLoadingLocations: true,
    locations: [],
    organization: {
      name: "Ada Industries",
      role: "manager",
    },
  },
};

export const ErrorLoadingLocations: Story = {
  args: {
    currentPath: "/dashboard",
    hasLocationLoadError: true,
    locations: [],
    organization: {
      name: "Ada Industries",
      role: "manager",
    },
  },
};

export const WithInactiveLocation: Story = {
  args: {
    currentPath: "/dashboard/locations/00000000-0000-4000-8000-000000000001/inventory",
    locations,
    organization: {
      name: "Ada Industries",
      role: "manager",
    },
    selectedLocationId: locations[0]?.id,
    selectedLocationName: locations[0]?.name,
  },
};

export const NoLocations: Story = {
  args: {
    currentPath: "/dashboard",
    locations: [],
    organization: {
      name: "Ada Industries",
      role: "manager",
    },
  },
};

export const NoOrganizationSelected: Story = {
  args: {
    currentPath: "/dashboard/locations",
    organization: null,
  },
};

export const ViewerNavigation: Story = {
  args: {
    currentPath: "/dashboard/categories",
    organization: {
      name: "Grace Supply",
      role: "viewer",
    },
  },
};

export const MobileNavigation: Story = {
  args: {
    currentPath: "/dashboard/locations",
    defaultMobileOpen: true,
    organization: {
      name: "Grace Supply",
      role: "manager",
    },
  },
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
};
