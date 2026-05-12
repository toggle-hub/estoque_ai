import type { Meta, StoryObj } from "@storybook/nextjs";
import {
  DashboardOverviewView,
  type DashboardActivity,
  type DashboardLowStockAlert,
} from "../app/components/dashboard/dashboard-overview-view";
import type { Organization } from "../app/lib/api";

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

const activities: DashboardActivity[] = [
  {
    actorName: "Ana Souza",
    id: "40000000-0000-4000-8000-000000000001",
    itemName: "Leitor sem fio",
    locationName: "Depósito principal",
    occurredAt: "2026-05-11T13:20:00.000Z",
    quantity: 12,
    sku: "SCN-100",
    type: "RECEIVING",
  },
  {
    actorName: "Bruno Lima",
    id: "40000000-0000-4000-8000-000000000002",
    itemName: "Etiquetas térmicas",
    locationName: "Loja secundária",
    occurredAt: "2026-05-11T11:45:00.000Z",
    quantity: -6,
    sku: "LBL-010",
    type: "SALE",
  },
  {
    actorName: "Ana Souza",
    id: "40000000-0000-4000-8000-000000000003",
    itemName: "Caixa de envio",
    locationName: "Depósito principal",
    occurredAt: "2026-05-10T18:10:00.000Z",
    quantity: 40,
    sku: "BOX-020",
    type: "RECEIVING",
  },
];

const lowStockAlerts: DashboardLowStockAlert[] = [
  {
    id: "50000000-0000-4000-8000-000000000001",
    itemName: "Etiquetas térmicas",
    locationName: "Loja secundária",
    quantity: 0,
    reorderPoint: 20,
    sku: "LBL-010",
    status: "critical",
  },
  {
    id: "50000000-0000-4000-8000-000000000002",
    itemName: "Leitor sem fio",
    locationName: "Depósito principal",
    quantity: 4,
    reorderPoint: 8,
    sku: "SCN-100",
    status: "low",
  },
  {
    id: "50000000-0000-4000-8000-000000000003",
    itemName: "Fita adesiva",
    locationName: "Expedição",
    quantity: 6,
    reorderPoint: 10,
    sku: "PKG-040",
    status: "low",
  },
];

const meta = {
  title: "Páginas/Painel operacional",
  component: DashboardOverviewView,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof DashboardOverviewView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  args: {
    activities,
    lowStockAlerts,
    metrics: {
      inventoryValue: 28432.7,
      lowStockItems: 3,
      totalSkus: 128,
      totalStockUnits: 6840,
    },
    organization,
  },
};

export const Loading: Story = {
  args: {
    activities: [],
    isLoading: true,
    lowStockAlerts: [],
    organization,
  },
};

export const Empty: Story = {
  args: {
    activities: [],
    lowStockAlerts: [],
    metrics: {
      inventoryValue: 0,
      lowStockItems: 0,
      totalSkus: 0,
      totalStockUnits: 0,
    },
    organization,
  },
};

export const NoActivity: Story = {
  args: {
    activities: [],
    lowStockAlerts,
    metrics: {
      inventoryValue: 28432.7,
      lowStockItems: 3,
      totalSkus: 128,
      totalStockUnits: 6840,
    },
    organization,
  },
};

export const NoAlerts: Story = {
  args: {
    activities,
    lowStockAlerts: [],
    metrics: {
      inventoryValue: 28432.7,
      lowStockItems: 0,
      totalSkus: 128,
      totalStockUnits: 6840,
    },
    organization,
  },
};

export const ErrorState: Story = {
  args: {
    activities: [],
    errorMessage: "A API não respondeu.",
    lowStockAlerts: [],
    metrics: {
      inventoryValue: 0,
      lowStockItems: 0,
      totalSkus: 0,
      totalStockUnits: 0,
    },
    onRetry: () => undefined,
    organization,
  },
};
