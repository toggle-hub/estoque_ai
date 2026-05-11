import type { Meta, StoryObj } from "@storybook/nextjs";
import { Field } from "../app/components/ui/field";
import { Input } from "../app/components/ui/input";
import { Label } from "../app/components/ui/label";
import { Select, SelectItem } from "../app/components/ui/select";

const meta = {
  title: "Componentes/Form Primitives",
  parameters: {
    layout: "centered",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Renders the text input field story.
 *
 * @returns Text field story element.
 */
const renderTextField = () => (
  <Field className="w-80">
    <Label htmlFor="storybook-product-search">Busca</Label>
    <Input id="storybook-product-search" placeholder="SKU, item ou referência" />
  </Field>
);

/**
 * Renders the select field story.
 *
 * @returns Select field story element.
 */
const renderSelectField = () => (
  <Field className="w-80">
    <Label htmlFor="storybook-location-select">Local</Label>
    <Select id="storybook-location-select" defaultValue="main">
      <SelectItem value="all">Todos os locais</SelectItem>
      <SelectItem value="main">Depósito principal</SelectItem>
      <SelectItem value="store">Loja secundária</SelectItem>
    </Select>
  </Field>
);

export const TextField: Story = {
  render: renderTextField,
};

export const SelectField: Story = {
  render: renderSelectField,
};
