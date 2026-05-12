import type { Meta, StoryObj } from "@storybook/nextjs";
import { toast } from "sonner";
import { Button } from "../app/components/ui/button";
import { Toaster } from "../app/components/ui/sonner";

const meta = {
  title: "Componentes/Sonner",
  component: Toaster,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Toaster>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Renders controls for previewing operation success and failure toasts.
 *
 * @returns Sonner preview story element.
 */
const SonnerStory = () => (
  <div className="flex gap-2">
    <Toaster />
    <Button onClick={() => toast.success("Operação concluída.")} type="button">
      Sucesso
    </Button>
    <Button
      onClick={() => toast.error("Não foi possível concluir a operação.")}
      type="button"
      variant="outline"
    >
      Falha
    </Button>
  </div>
);

export const Default: Story = {
  render: SonnerStory,
};
