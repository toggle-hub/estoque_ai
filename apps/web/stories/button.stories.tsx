import type { Meta, StoryObj } from "@storybook/nextjs";
import { PackagePlus } from "lucide-react";
import { Button } from "../app/components/ui/button";

const meta = {
  title: "Componentes/Button",
  component: Button,
  argTypes: {
    asChild: {
      control: "boolean",
    },
    disabled: {
      control: "boolean",
    },
    size: {
      control: "select",
      options: ["default", "icon"],
    },
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "ghost"],
    },
  },
  args: {
    asChild: false,
    children: "Adicionar",
    disabled: false,
    size: "default",
    variant: "default",
  },
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Destructive: Story = {
  args: {
    children: "Remover",
    variant: "destructive",
  },
};

export const Outline: Story = {
  args: {
    children: "Cancelar",
    variant: "outline",
  },
};

export const Ghost: Story = {
  args: {
    children: "Ver detalhes",
    variant: "ghost",
  },
};

export const Icon: Story = {
  args: {
    "aria-label": "Criar item",
    children: <PackagePlus />,
    size: "icon",
  },
};

/**
 * Renders a Button that clones styling and props onto an anchor child.
 *
 * @returns Button asChild story element.
 */
const ButtonAsChildStory = () => (
  <Button asChild className="min-w-40" variant="outline">
    <a href="/dashboard/items" className="font-semibold">
      Abrir itens
    </a>
  </Button>
);

export const AsChild: Story = {
  args: {
    asChild: true,
    children: "Abrir itens",
    variant: "outline",
  },
  render: ButtonAsChildStory,
};
