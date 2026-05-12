import type { Meta, StoryObj } from "@storybook/nextjs";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "../app/components/ui/alert";

const meta = {
  title: "Componentes/Alert",
  component: Alert,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Alert>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Alert className="w-[420px]" variant="default">
      <AlertTitle>Estoque atualizado</AlertTitle>
      <AlertDescription>
        Os indicadores foram recalculados com os movimentos mais recentes.
      </AlertDescription>
    </Alert>
  ),
};

export const Destructive: Story = {
  render: () => (
    <Alert className="w-[420px]" variant="destructive">
      <AlertTitle>Não foi possível carregar os dados</AlertTitle>
      <AlertDescription>
        Verifique a conexão e tente novamente em alguns instantes.
      </AlertDescription>
    </Alert>
  ),
};

export const Warning: Story = {
  render: () => (
    <Alert className="w-[420px]" variant="warning">
      <AlertTitle>Acesso de visualizador</AlertTitle>
      <AlertDescription>
        Visualizadores podem consultar informações, mas não podem criar ou editar registros.
      </AlertDescription>
    </Alert>
  ),
};
