import type { Preview } from "@storybook/nextjs";
import type { ReactNode } from "react";
import "../app/globals.css";
import { Providers } from "../app/providers";

const preview: Preview = {
  decorators: [
    (Story: () => ReactNode) => (
      <Providers>
        <Story />
      </Providers>
    ),
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    nextjs: {
      appDirectory: true,
    },
  },
};

export default preview;
