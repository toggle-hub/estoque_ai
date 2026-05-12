import type { Meta, StoryObj } from "@storybook/nextjs";
import type { ComponentProps, ReactNode } from "react";
import { SpotlightTourOverlay } from "../app/components/onboarding/spotlight-tour";

const contentRect = {
  height: 176,
  left: 112,
  top: 128,
  width: 640,
};

const navigationRect = {
  height: 44,
  left: 24,
  top: 244,
  width: 240,
};

const meta = {
  title: "Componentes/Spotlight Tour",
  component: SpotlightTourOverlay,
  argTypes: {
    isDismissed: {
      control: "boolean",
    },
    targetType: {
      control: "select",
      options: ["content", "navigation"],
    },
  },
  args: {
    description:
      "Use esta etapa para conduzir a configuração inicial sem sair do fluxo operacional.",
    isDismissed: false,
    targetRect: contentRect,
    targetType: "content",
    title: "Primeiros passos",
  },
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof SpotlightTourOverlay>;

export default meta;

type Story = StoryObj<typeof meta>;
type SpotlightTourStoryArgs = ComponentProps<typeof SpotlightTourOverlay>;

/**
 * Renders a fake app shell behind the spotlight overlay.
 *
 * @param children Overlay story content.
 * @returns Story shell element.
 */
const SpotlightStoryFrame = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen bg-white text-[#16151c]">
    <aside className="fixed inset-y-0 left-0 w-72 bg-purple-100 p-4">
      <div className="mb-6 text-lg font-bold">estoque ai</div>
      <div className="space-y-2">
        <div className="rounded-r-md border-l-2 border-l-transparent px-4 py-2.5 text-sm font-semibold">
          Painel
        </div>
        <div className="rounded-r-md border-l-2 border-l-purple-500 bg-white px-4 py-2.5 text-sm font-semibold text-purple-700 shadow-sm">
          Locais
        </div>
        <div className="rounded-r-md border-l-2 border-l-transparent px-4 py-2.5 text-sm font-semibold">
          Categorias
        </div>
      </div>
    </aside>
    <main className="ml-72 p-10">
      <div className="max-w-3xl rounded-md border border-purple-200 bg-purple-50/50 p-5">
        <h1 className="m-0 text-base font-semibold">Primeiros passos</h1>
        <p className="m-0 mt-2 text-sm text-gray-600">
          Siga a sequência operacional mínima para começar a movimentar estoque.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-md border border-purple-200 bg-white p-3">
            Criar local
          </div>
          <div className="rounded-md border border-purple-100 bg-white/80 p-3">
            Catálogo
          </div>
          <div className="rounded-md border border-purple-100 bg-white/80 p-3">
            Recebimento
          </div>
        </div>
      </div>
    </main>
    {children}
  </div>
);

/**
 * Renders a content spotlight over the first-run guidance card.
 *
 * @param args Storybook args forwarded to the overlay.
 * @returns Content spotlight story element.
 */
const ContentSpotlightStory = (args: SpotlightTourStoryArgs) => (
  <SpotlightStoryFrame>
    <SpotlightTourOverlay
      {...args}
      targetRect={contentRect}
      targetType="content"
    />
  </SpotlightStoryFrame>
);

/**
 * Renders a navigation spotlight over the next route target.
 *
 * @param args Storybook args forwarded to the overlay.
 * @returns Navigation spotlight story element.
 */
const NavigationSpotlightStory = (args: SpotlightTourStoryArgs) => (
  <SpotlightStoryFrame>
    <SpotlightTourOverlay
      {...args}
      description="Abra locais para cadastrar onde o estoque físico será controlado."
      targetRect={navigationRect}
      targetType="navigation"
      title="Próximo destino"
    />
  </SpotlightStoryFrame>
);

/**
 * Renders the dismissed spotlight state.
 *
 * @param args Storybook args forwarded to the overlay.
 * @returns Dismissed spotlight story element.
 */
const DismissedStory = (args: SpotlightTourStoryArgs) => (
  <SpotlightStoryFrame>
    <SpotlightTourOverlay {...args} isDismissed targetRect={contentRect} />
  </SpotlightStoryFrame>
);

/**
 * Renders read-only viewer copy with no unavailable creation CTA.
 *
 * @param args Storybook args forwarded to the overlay.
 * @returns Viewer spotlight story element.
 */
const ViewerStory = (args: SpotlightTourStoryArgs) => (
  <SpotlightStoryFrame>
    <SpotlightTourOverlay
      {...args}
      description="Este painel mostra o que ainda falta configurar. Seu acesso permite acompanhar e pesquisar, sem criar ou editar registros."
      targetRect={contentRect}
      targetType="content"
      title="Primeiros passos"
    />
  </SpotlightStoryFrame>
);

/**
 * Renders the tour after location and catalog setup have been completed.
 *
 * @param args Storybook args forwarded to the overlay.
 * @returns Partially completed setup spotlight story element.
 */
const PartiallyCompletedStory = (args: SpotlightTourStoryArgs) => (
  <SpotlightStoryFrame>
    <SpotlightTourOverlay
      {...args}
      description="Abra recebimento quando locais e catálogo estiverem prontos para entrada inicial de estoque."
      targetRect={navigationRect}
      targetType="navigation"
      title="Próximo destino"
    />
  </SpotlightStoryFrame>
);

export const ContentSpotlight: Story = {
  render: ContentSpotlightStory,
};

export const NavigationSpotlight: Story = {
  render: NavigationSpotlightStory,
};

export const Dismissed: Story = {
  args: {
    isDismissed: true,
  },
  render: DismissedStory,
};

export const Viewer: Story = {
  render: ViewerStory,
};

export const PartiallyCompletedSetup: Story = {
  render: PartiallyCompletedStory,
};
