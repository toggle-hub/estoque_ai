import type { Meta, StoryObj } from "@storybook/nextjs";
import { Skeleton } from "../app/components/ui/skeleton";

const meta = {
  title: "Componentes/Skeleton",
  component: Skeleton,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Skeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Renders a compact skeleton group for card-like loading states.
 *
 * @returns Skeleton story element.
 */
const SkeletonDefaultStory = () => (
  <div className="w-[360px] rounded-md border border-purple-100 bg-white p-5">
    <Skeleton className="h-4 w-28" />
    <Skeleton className="mt-3 h-8 w-44" />
    <Skeleton className="mt-4 h-4 w-full" />
    <Skeleton className="mt-2 h-4 w-4/5" />
  </div>
);

export const Default: Story = {
  render: SkeletonDefaultStory,
};
