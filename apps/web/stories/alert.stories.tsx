import type { Meta, StoryObj } from "@storybook/nextjs";
import type { JSX } from "react";
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

/**
 * Renders the default alert variant for neutral status messages.
 *
 * @returns Default alert story element.
 */
const AlertDefaultStory = (): JSX.Element => (
  <Alert className="w-[420px]" variant="default">
    <AlertTitle>Estoque atualizado</AlertTitle>
    <AlertDescription>
      Os indicadores foram recalculados com os movimentos mais recentes.
    </AlertDescription>
  </Alert>
);

/**
 * Renders the destructive alert variant for blocking error messages.
 *
 * @returns Destructive alert story element.
 */
const AlertDestructiveStory = (): JSX.Element => (
  <Alert className="w-[420px]" variant="destructive">
    <AlertTitle>Não foi possível carregar os dados</AlertTitle>
    <AlertDescription>
      Verifique a conexão e tente novamente em alguns instantes.
    </AlertDescription>
  </Alert>
);

/**
 * Renders the warning alert variant for permission and attention states.
 *
 * @returns Warning alert story element.
 */
const AlertWarningStory = (): JSX.Element => (
  <Alert className="w-[420px]" variant="warning">
    <AlertTitle>Acesso de visualizador</AlertTitle>
    <AlertDescription>
      Visualizadores podem consultar informações, mas não podem criar ou editar registros.
    </AlertDescription>
  </Alert>
);

export const Default: Story = {
  render: AlertDefaultStory,
};

export const Destructive: Story = {
  render: AlertDestructiveStory,
};

export const Warning: Story = {
  render: AlertWarningStory,
};
