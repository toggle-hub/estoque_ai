import type { Meta, StoryObj } from "@storybook/nextjs";
import { LocationsManagementView } from "../app/components/locations/locations-management-view";
import type { Location, Organization } from "../app/lib/api";

const organization: Organization = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Ada Industries",
  cnpj: "12.345.678/0001-90",
  email: "ops@ada.example",
  phone: null,
  plan_type: "profissional",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  role: "admin",
};

const locations: Location[] = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    organization_id: organization.id,
    name: "Main Warehouse",
    address: "Rua A, 100",
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    organization_id: organization.id,
    name: "Secondary Store",
    address: "Rua B, 200",
    is_active: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
  },
];

const meta = {
  title: "Pages/Locations Management",
  component: LocationsManagementView,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof LocationsManagementView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  args: {
    locations,
    organization,
    summaries: {
      [locations[0]?.id ?? ""]: {
        itemCount: 18,
        lowStockCount: 2,
        totalQuantity: 264,
        totalValue: 12430.5,
      },
      [locations[1]?.id ?? ""]: {
        itemCount: 6,
        lowStockCount: 0,
        totalQuantity: 72,
        totalValue: 2910,
      },
    },
    selectedLocationId: locations[0]?.id,
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
    locations: [],
    organization,
  },
};

export const Empty: Story = {
  args: {
    locations: [],
    organization,
  },
};

export const ErrorState: Story = {
  args: {
    errorMessage: "The API did not respond.",
    locations: [],
    organization,
  },
};

export const RoleRestricted: Story = {
  args: {
    locations,
    organization: {
      ...organization,
      role: "viewer",
    },
  },
};
