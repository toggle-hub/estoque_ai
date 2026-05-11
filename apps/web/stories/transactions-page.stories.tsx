import type { Meta, StoryObj } from "@storybook/nextjs";
import { TransactionsPageView } from "../app/dashboard/transactions/page";
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

const activeLocations: Location[] = [
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

const selectedLocation = {
  id: activeLocations[0]?.id ?? "",
  name: activeLocations[0]?.name ?? "Depósito principal",
};

const meta = {
  title: "Páginas/Transactions Page",
  component: TransactionsPageView,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof TransactionsPageView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    activeLocations,
    hasLocationLoadError: false,
    isLoading: false,
    isLoadingLocations: false,
    onRetry: () => undefined,
    onSelectLocation: () => undefined,
    organization,
    selectedLocation,
  },
};

export const Loading: Story = {
  args: {
    ...Default.args,
    isLoading: true,
  },
};

export const ErrorState: Story = {
  args: {
    ...Default.args,
    errorMessage: "A API não respondeu.",
    hasLocationLoadError: true,
  },
};

export const SingleLocationAutoSelection: Story = {
  args: {
    ...Default.args,
    activeLocations: activeLocations.slice(0, 1),
    selectedLocation,
  },
};
