import type { Meta, StoryObj } from "@storybook/nextjs";
import { Spinner } from "../app/components/ui/spinner";

const meta = {
  title: "Components/Spinner",
  component: Spinner,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof Spinner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Large: Story = {
  args: {
    className: "size-10",
  },
};
