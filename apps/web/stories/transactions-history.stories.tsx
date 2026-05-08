import type { Meta, StoryObj } from "@storybook/nextjs";
import {
  TransactionsHistoryView,
  type InventoryTransaction,
} from "../app/components/transactions/transactions-history-view";
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
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
  },
];

const transactions: InventoryTransaction[] = [
  {
    id: "40000000-0000-4000-8000-000000000001",
    type: "RECEIVING",
    quantity: 8,
    previousQuantity: 12,
    newQuantity: 20,
    reference: "NF-000123",
    notes: "Supplier delivery",
    performedBy: "Grace Hopper",
    createdAt: "2026-01-03T13:15:00.000Z",
    item: {
      id: "30000000-0000-4000-8000-000000000001",
      sku: "SCN-100",
      name: "Wireless Scanner",
    },
    location: {
      id: locations[0]?.id ?? "",
      name: locations[0]?.name ?? "Main Warehouse",
    },
  },
  {
    id: "40000000-0000-4000-8000-000000000002",
    type: "SALE",
    quantity: 5,
    previousQuantity: 30,
    newQuantity: 25,
    reference: "PED-000456",
    notes: null,
    performedBy: "Ada Lovelace",
    createdAt: "2026-01-04T09:30:00.000Z",
    item: {
      id: "30000000-0000-4000-8000-000000000002",
      sku: "LBL-010",
      name: "Thermal Labels",
    },
    location: {
      id: locations[1]?.id ?? "",
      name: locations[1]?.name ?? "Secondary Store",
    },
  },
];

const meta = {
  title: "Pages/Transactions History",
  component: TransactionsHistoryView,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof TransactionsHistoryView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  args: {
    locations,
    organization,
    transactions,
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
    locations,
    organization,
    transactions: [],
  },
};

export const Empty: Story = {
  args: {
    locations,
    organization,
    transactions: [],
  },
};

export const FilteredNoResults: Story = {
  args: {
    locations,
    organization,
    transactions,
  },
};

export const ErrorState: Story = {
  args: {
    errorMessage: "The API did not respond.",
    locations,
    onRetry: () => undefined,
    organization,
    transactions: [],
  },
};
