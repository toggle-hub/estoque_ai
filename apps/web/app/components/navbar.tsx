import {
  Boxes,
  FileBarChart2,
  FolderOpen,
  LayoutDashboard,
  Package,
  ShoppingBag,
  Wrench,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard" },
  { icon: Package, label: "Items" },
  { icon: Wrench, label: "Tools" },
  { icon: FolderOpen, label: "Assets" },
  { icon: ShoppingBag, label: "Project" },
  { icon: Boxes, label: "On Hand" },
  { icon: FileBarChart2, label: "GRN Report" },
];

export const Navbar = () => {
  return (
    <aside className="w-64 h-screen flex flex-col bg-purple-100 ">
      <div className="flex items-center gap-3 px-6 py-2">
        <Image src="/logo.svg" alt="estoque ai logo" width={100} height={50} />
      </div>

      <nav className="flex-row items-center justify-center px-3 py-4 space-y-1">
        {navItems.map(({ icon: Icon, label }) => (
          <Link
            key={label}
            href="/"
            className="flex items-center gap-3 px-6 py-2.5 rounded-r-lg text-black hover:bg-purple-500/10 hover:border-l-2 hover:border-l-purple-500 hover:text-purple-500 transition-colors duration-150"
          >
            <Icon size={18} />
            <span className="text-sm font-medium">{label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
};
