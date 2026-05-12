import type { Meta, StoryObj } from "@storybook/nextjs";
import {
  FirstRunGuidance,
  type FirstRunGuidanceStep,
} from "../app/components/onboarding/first-run-guidance";
import type { Organization } from "../app/lib/api";

const organization: Organization = {
  id: "00000000-0000-4000-8000-000000000045",
  name: "Indústrias Ada",
  cnpj: "12.345.678/0001-90",
  email: "ops@ada.example",
  phone: null,
  plan_type: "profissional",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  role: "admin",
};

const viewerOrganization: Organization = {
  ...organization,
  id: "00000000-0000-4000-8000-000000000046",
  role: "viewer",
};

const meta = {
  title: "Componentes/First Run Guidance",
  component: FirstRunGuidance,
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof FirstRunGuidance>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Renders guidance for a brand-new setup with no completed operational steps.
 *
 * @returns First-run guidance story element.
 */
const FirstRunStory = () => (
  <div className="w-[760px]">
    <FirstRunGuidance
      canManage
      currentStep="location"
      forceVisible
      organization={organization}
    />
  </div>
);

/**
 * Renders the dismissed guidance state.
 *
 * @returns Dismissed guidance story element.
 */
const DismissedStory = () => (
  <div className="w-[760px]">
    <FirstRunGuidance
      canManage
      currentStep="location"
      initialDismissed
      organization={organization}
    />
    <p className="m-0 rounded-md border border-dashed border-purple-200 p-4 text-sm text-[#5c6670]">
      Orientação ocultada para esta organização.
    </p>
  </div>
);

/**
 * Renders read-only guidance for viewer roles.
 *
 * @returns Viewer guidance story element.
 */
const ViewerStory = () => (
  <div className="w-[760px]">
    <FirstRunGuidance
      canManage={false}
      currentStep="catalog"
      forceVisible
      organization={viewerOrganization}
    />
  </div>
);

/**
 * Renders guidance after some setup steps have already been completed.
 *
 * @returns Partially completed guidance story element.
 */
const PartiallyCompletedStory = () => {
  const completedSteps: FirstRunGuidanceStep[] = ["location", "catalog"];

  return (
    <div className="w-[760px]">
      <FirstRunGuidance
        canManage
        completedSteps={completedSteps}
        currentStep="receiving"
        forceVisible
        organization={organization}
      />
    </div>
  );
};

export const FirstRun: Story = {
  args: {
    canManage: true,
    currentStep: "location",
    organization,
  },
  render: FirstRunStory,
};

export const Dismissed: Story = {
  args: {
    canManage: true,
    currentStep: "location",
    organization,
  },
  render: DismissedStory,
};

export const Viewer: Story = {
  args: {
    canManage: false,
    currentStep: "catalog",
    organization: viewerOrganization,
  },
  render: ViewerStory,
};

export const PartiallyCompleted: Story = {
  args: {
    canManage: true,
    currentStep: "receiving",
    organization,
  },
  render: PartiallyCompletedStory,
};
