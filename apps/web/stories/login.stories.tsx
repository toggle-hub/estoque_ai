import type { Meta, StoryObj } from "@storybook/nextjs";
import LoginRoute from "../app/auth/login/page";

const meta = {
  title: "Pages/Login",
  component: LoginRoute,
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof LoginRoute>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
