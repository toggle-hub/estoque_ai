import type { Meta, StoryObj } from "@storybook/nextjs";
import {
  ReceivingView,
  type ReceivingItem,
} from "../app/components/receiving/receiving-view";
import type { Location, Organization } from "../app/lib/api";

const organization: Organization = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Indústrias Ada",
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
    name: "Depósito principal",
    address: "Rua A, 100",
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    organization_id: organization.id,
    name: "Loja secundária",
    address: "Rua B, 200",
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
  },
];

const items: ReceivingItem[] = [
  {
    id: "30000000-0000-4000-8000-000000000001",
    organization_id: organization.id,
    location_id: locations[0]?.id ?? "",
    category_id: null,
    sku: "SCN-100",
    name: "Leitor sem fio",
    description: "Leitor portátil usado nas estações de recebimento.",
    unit_price: "899.90",
    reorder_point: 4,
    is_active: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
    category: null,
    quantity: 12,
  },
  {
    id: "30000000-0000-4000-8000-000000000002",
    organization_id: organization.id,
    location_id: locations[1]?.id ?? "",
    category_id: null,
    sku: "LBL-010",
    name: "Etiquetas térmicas",
    description: null,
    unit_price: "39.50",
    reorder_point: 20,
    is_active: true,
    created_at: "2026-01-02T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    deleted_at: null,
    category: null,
    quantity: 18,
  },
];

const meta = {
  title: "Pages/Receiving",
  component: ReceivingView,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof ReceivingView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    items,
    locations,
    onReceive: async () => undefined,
    organization,
  },
};

export const PreselectedItem: Story = {
  args: {
    items,
    locations,
    onReceive: async () => undefined,
    organization,
    preselectedItemId: items[0]?.id,
    preselectedLocationId: locations[0]?.id,
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
    items: [],
    locations: [],
    organization,
  },
};

export const Forbidden: Story = {
  args: {
    items,
    locations,
    organization: {
      ...organization,
      role: "viewer",
    },
  },
};
