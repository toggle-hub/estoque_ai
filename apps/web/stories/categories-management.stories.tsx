import type { Meta, StoryObj } from "@storybook/nextjs";
import { CategoriesManagementView } from "../app/components/categories/categories-management-view";
import type { Category, Organization } from "../app/lib/api";

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

const categories: Category[] = [
  {
    id: "10000000-0000-4000-8000-000000000010",
    organization_id: organization.id,
    name: "Electronics",
    description: "Devices, accessories, and replacement parts.",
    created_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "10000000-0000-4000-8000-000000000011",
    organization_id: organization.id,
    name: "Supplies",
    description: null,
    created_at: "2026-01-02T00:00:00.000Z",
    deleted_at: null,
  },
];

const meta = {
  title: "Pages/Categories Management",
  component: CategoriesManagementView,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof CategoriesManagementView>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Loaded: Story = {
  args: {
    categories,
    onCreate: async () => undefined,
    organization,
  },
};

export const Loading: Story = {
  args: {
    categories: [],
    isLoading: true,
    onCreate: async () => undefined,
    organization,
  },
};

export const Empty: Story = {
  args: {
    categories: [],
    onCreate: async () => undefined,
    organization,
  },
};

export const Creating: Story = {
  args: {
    categories,
    isCreating: true,
    onCreate: async () => undefined,
    organization,
  },
};

export const ErrorState: Story = {
  args: {
    categories: [],
    errorMessage: "The API did not respond.",
    onCreate: async () => undefined,
    organization,
  },
};

export const RoleRestricted: Story = {
  args: {
    categories,
    organization: {
      ...organization,
      role: "viewer",
    },
  },
};
