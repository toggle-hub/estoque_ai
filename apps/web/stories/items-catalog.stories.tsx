import type { Meta, StoryObj } from "@storybook/nextjs";
import { ItemsCatalogView, type CatalogItem } from "../app/components/items/items-catalog-view";
import type { Organization } from "../app/lib/api";

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

const items: CatalogItem[] = [
  {
    id: "30000000-0000-4000-8000-000000000001",
    sku: "SCN-100",
    name: "Wireless Scanner",
    categoryName: "Electronics",
    description: "Handheld scanner used at receiving stations.",
    unitPrice: "899.90",
    reorderPoint: 4,
    totalQuantity: 15,
    locations: [
      {
        inventoryHref: "/dashboard/locations/10000000-0000-4000-8000-000000000001/inventory",
        locationId: "10000000-0000-4000-8000-000000000001",
        locationName: "Main Warehouse",
        quantity: 12,
      },
      {
        inventoryHref: "/dashboard/locations/10000000-0000-4000-8000-000000000002/inventory",
        locationId: "10000000-0000-4000-8000-000000000002",
        locationName: "Secondary Store",
        quantity: 3,
      },
    ],
  },
  {
    id: "30000000-0000-4000-8000-000000000002",
    sku: "LBL-010",
    name: "Thermal Labels",
    categoryName: "Supplies",
    description: null,
    unitPrice: "39.50",
    reorderPoint: 20,
    totalQuantity: 18,
    locations: [
      {
        inventoryHref: "/dashboard/locations/10000000-0000-4000-8000-000000000001/inventory",
        locationId: "10000000-0000-4000-8000-000000000001",
        locationName: "Main Warehouse",
        quantity: 18,
      },
    ],
  },
  {
    id: "30000000-0000-4000-8000-000000000003",
    sku: "BOX-020",
    name: "Shipping Box",
    categoryName: null,
    description: "Uncategorized packaging item.",
    unitPrice: "4.20",
    reorderPoint: 10,
    totalQuantity: 44,
    locations: [
      {
        inventoryHref: "/dashboard/locations/10000000-0000-4000-8000-000000000001/inventory",
        locationId: "10000000-0000-4000-8000-000000000001",
        locationName: "Main Warehouse",
        quantity: 44,
      },
    ],
  },
];

const meta = {
  title: "Pages/Items Catalog",
  component: ItemsCatalogView,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof ItemsCatalogView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  args: {
    items,
    organization,
    selectedLocationId: "10000000-0000-4000-8000-000000000001",
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
    items: [],
    organization,
  },
};

export const Empty: Story = {
  args: {
    items: [],
    organization,
  },
};

export const ErrorState: Story = {
  args: {
    errorMessage: "The API did not respond.",
    items: [],
    onRetry: () => undefined,
    organization,
  },
};

export const Filters: Story = {
  args: {
    items,
    organization,
  },
};

export const RoleRestricted: Story = {
  args: {
    items,
    organization: {
      ...organization,
      role: "viewer",
    },
  },
};
