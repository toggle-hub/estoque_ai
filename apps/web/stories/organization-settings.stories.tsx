import type { Meta, StoryObj } from "@storybook/nextjs";
import { OrganizationSettingsView } from "../app/components/organizations/organization-settings-view";
import type { Organization } from "../app/lib/api";

const completeOrganization: Organization = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Ada Industries",
  cnpj: "12.345.678/0001-90",
  email: "ops@ada.example",
  phone: "+55 11 99999-0000",
  plan_type: "profissional",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  role: "admin",
};

const incompleteOrganization: Organization = {
  ...completeOrganization,
  cnpj: null,
  email: null,
  phone: null,
  plan_type: "essencial",
};

const meta = {
  title: "Pages/Organization Settings",
  component: OrganizationSettingsView,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof OrganizationSettingsView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CompleteProfile: Story = {
  args: {
    onSave: async () => undefined,
    organization: completeOrganization,
  },
};

export const IncompleteProfile: Story = {
  args: {
    onSave: async () => undefined,
    organization: incompleteOrganization,
  },
};

export const Saving: Story = {
  args: {
    isSaving: true,
    onSave: async () => undefined,
    organization: incompleteOrganization,
  },
};

export const ErrorState: Story = {
  args: {
    errorMessage: "The API did not respond.",
    onSave: async () => undefined,
    organization: completeOrganization,
  },
};

export const ViewerReadOnly: Story = {
  args: {
    onSave: async () => undefined,
    organization: {
      ...completeOrganization,
      role: "viewer",
    },
  },
};
