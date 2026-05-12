import type { Meta, StoryObj } from "@storybook/nextjs";
import { OrganizationSelectionView } from "../app/components/organizations/organization-selection-view";
import type { Organization } from "../app/lib/api";

const organizations: Organization[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Indústrias Ada",
    cnpj: "12.345.678/0001-90",
    email: "ops@ada.example",
    phone: null,
    plan_type: "essencial",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    role: "admin",
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: "Suprimentos Grace",
    cnpj: null,
    email: "inventory@grace.example",
    phone: null,
    plan_type: "profissional",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    role: "manager",
  },
];

const meta = {
  title: "Páginas/Seleção de organização",
  component: OrganizationSelectionView,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof OrganizationSelectionView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  args: {
    organizations,
    selectedOrganizationId: organizations[0]?.id,
  },
};

export const SwitchingOrganization: Story = {
  args: {
    organizations,
    selectedOrganizationId: organizations[1]?.id,
  },
};

export const Loading: Story = {
  args: {
    isLoading: true,
    organizations: [],
  },
};

export const Empty: Story = {
  args: {
    organizations: [],
  },
};

export const ErrorState: Story = {
  args: {
    errorMessage: "A API não respondeu.",
    organizations: [],
  },
};

export const CreateOrganizationCreating: Story = {
  args: {
    isCreating: true,
    organizations,
    selectedOrganizationId: organizations[0]?.id,
  },
};
