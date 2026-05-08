import type { Meta, StoryObj } from "@storybook/nextjs";
import { LocationInventoryView } from "../app/components/inventory/location-inventory-view";
import type { Category, Location, LocationItem, Organization } from "../app/lib/api";

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

const location: Location = {
  id: "10000000-0000-4000-8000-000000000001",
  organization_id: organization.id,
  name: "Main Warehouse",
  address: "Rua A, 100",
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
};

const categories: Category[] = [
  {
    id: "20000000-0000-4000-8000-000000000010",
    organization_id: organization.id,
    name: "Electronics",
    description: "Devices and accessories.",
    created_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "20000000-0000-4000-8000-000000000011",
    organization_id: organization.id,
    name: "Supplies",
    description: null,
    created_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
  },
];

const items: LocationItem[] = [
  {
    id: "30000000-0000-4000-8000-000000000001",
    organization_id: organization.id,
    category_id: categories[0]?.id ?? null,
    sku: "SCN-100",
    name: "Wireless Scanner",
    description: "Handheld scanner used at receiving stations.",
    unit_price: "899.90",
    reorder_point: 4,
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
    category: categories[0] ?? null,
    quantity: 12,
  },
  {
    id: "30000000-0000-4000-8000-000000000002",
    organization_id: organization.id,
    category_id: categories[1]?.id ?? null,
    sku: "LBL-010",
    name: "Thermal Labels",
    description: null,
    unit_price: "39.50",
    reorder_point: 20,
    is_active: true,
    created_at: "2026-01-02T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    deleted_at: null,
    category: categories[1] ?? null,
    quantity: 18,
  },
  {
    id: "30000000-0000-4000-8000-000000000003",
    organization_id: organization.id,
    category_id: null,
    sku: "BOX-020",
    name: "Shipping Box",
    description: "Uncategorized packaging item.",
    unit_price: "4.20",
    reorder_point: 10,
    is_active: true,
    created_at: "2026-01-03T00:00:00.000Z",
    updated_at: "2026-01-03T00:00:00.000Z",
    deleted_at: null,
    category: null,
    quantity: 44,
  },
];

const meta = {
  title: "Pages/Location Inventory",
  component: LocationInventoryView,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof LocationInventoryView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  args: {
    categories,
    items,
    location,
    onCreate: async () => undefined,
    organization,
  },
};

export const Loading: Story = {
  args: {
    categories,
    isLoading: true,
    items: [],
    location,
    onCreate: async () => undefined,
    organization,
  },
};

export const Empty: Story = {
  args: {
    categories,
    items: [],
    location,
    onCreate: async () => undefined,
    organization,
  },
};

export const ErrorState: Story = {
  args: {
    categories,
    errorMessage: "The API did not respond.",
    items: [],
    location,
    onCreate: async () => undefined,
    organization,
  },
};

export const LowStock: Story = {
  args: {
    categories,
    items: items.map((item) => ({
      ...item,
      quantity: Math.min(item.quantity, item.reorder_point),
    })),
    location,
    onCreate: async () => undefined,
    organization,
  },
};

export const RoleRestricted: Story = {
  args: {
    categories,
    items,
    location,
    onCreate: async () => undefined,
    organization: {
      ...organization,
      role: "viewer",
    },
  },
};
