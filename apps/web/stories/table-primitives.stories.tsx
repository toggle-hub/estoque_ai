import type { Meta, StoryObj } from "@storybook/nextjs";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../app/components/ui/table";

const meta = {
  title: "Componentes/Table",
  parameters: {
    layout: "centered",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Renders the table primitive story.
 *
 * @returns Table primitive example.
 */
const renderTable = () => (
  <div className="w-[680px] overflow-x-auto rounded-md border border-purple-100 bg-white">
    <Table>
      <TableCaption>Itens com estoque baixo por local.</TableCaption>
      <TableHeader>
        <TableRow className="border-t-0">
          <TableHead>Item</TableHead>
          <TableHead>Local</TableHead>
          <TableHead className="text-right">Qtd.</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>
            <div className="font-semibold">Etiquetas térmicas</div>
            <div className="mt-1 font-mono text-xs text-[#5c6670]">LBL-010</div>
          </TableCell>
          <TableCell>Loja secundária</TableCell>
          <TableCell className="text-right font-semibold">0</TableCell>
          <TableCell>Crítico</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>
            <div className="font-semibold">Leitor sem fio</div>
            <div className="mt-1 font-mono text-xs text-[#5c6670]">SCN-100</div>
          </TableCell>
          <TableCell>Depósito principal</TableCell>
          <TableCell className="text-right font-semibold">4</TableCell>
          <TableCell>Baixo</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
);

export const Default: Story = {
  render: renderTable,
};
