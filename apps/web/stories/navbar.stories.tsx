import type { Meta, StoryObj } from "@storybook/nextjs";
import { Navbar } from "../app/components/navbar";

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
