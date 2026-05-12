import type { Meta, StoryObj } from "@storybook/nextjs";
import { CategoriesManagementView } from "../app/components/categories/categories-management-view";
import type { Category, Organization } from "../app/lib/api";

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

const categories: Category[] = [
  {
    id: "10000000-0000-4000-8000-000000000010",
    organization_id: organization.id,
    name: "Eletrônicos",
    description: "Dispositivos, acessórios e peças de reposição.",
    created_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "10000000-0000-4000-8000-000000000011",
    organization_id: organization.id,
    name: "Suprimentos",
    description: null,
    created_at: "2026-01-02T00:00:00.000Z",
    deleted_at: null,
  },
];

const manyCategories: Category[] = Array.from({ length: 48 }, (_, index) => ({
  id: `10000000-0000-4000-8000-${String(index + 100).padStart(12, "0")}`,
  organization_id: organization.id,
  name: `Category ${String(index + 1).padStart(2, "0")}`,
  description:
    index % 3 === 0 ? "Uma descrição de taxonomia mais longa usada para validar quebra de linha no cartão." : null,
  created_at: `2026-01-${String((index % 28) + 1).padStart(2, "0")}T00:00:00.000Z`,
  deleted_at: null,
}));

const meta = {
  title: "Páginas/Gerenciamento de categorias",
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

export const FirstRunEmptyState: Story = {
  args: {
    categories: [],
    onCreate: async () => undefined,
    organization,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Shows the first-run category setup state with currentStep=\"catalog\" and create-capable guidance.",
      },
    },
  },
};

export const FirstRunEmptyStateViewer: Story = {
  args: {
    categories: [],
    organization: {
      ...organization,
      role: "viewer",
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "Shows the first-run category setup state for canCreate=false; viewer guidance stays read-only and omits create actions.",
      },
    },
  },
};

export const ManyCategories: Story = {
  args: {
    categories: manyCategories,
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
    errorMessage: "A API não respondeu.",
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
