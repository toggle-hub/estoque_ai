import * as React from "react";
import { cn } from "../../lib/utils";

type ButtonProps = React.ComponentProps<"button"> & {
  asChild?: boolean;
  variant?: "default" | "destructive" | "outline" | "ghost";
  size?: "default" | "icon";
};

const variants = {
  default: "bg-purple-500 text-white hover:bg-purple-600",
  destructive: "bg-[#b42318] text-white hover:bg-[#9f1f16]",
  outline: "border border-purple-200 bg-white text-[#16151c] hover:bg-purple-100",
  ghost: "bg-transparent text-[#16151c] hover:bg-purple-100",
};

const sizes = {
  default: "h-10 px-4 py-2",
  icon: "size-10",
};

/**
 * Renders a shadcn-style button primitive.
 *
 * @param props Button props and style options.
 * @returns Styled button element.
 */
export function Button({
  asChild = false,
  className,
  children,
  size = "default",
  type = "button",
  variant = "default",
  ...props
}: ButtonProps) {
  const buttonClassName = cn(
    "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:pointer-events-none disabled:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0",
    variants[variant],
    sizes[size],
    className,
  );

  if (asChild && React.isValidElement<{ className?: string; type?: typeof type }>(children)) {
    const childProps =
      children.type === "button" && children.props.type === undefined ? { type } : {};

    return React.cloneElement(children, {
      className: cn(buttonClassName, children.props.className),
      ...childProps,
      ...props,
    });
  }

  return (
    <button
      data-slot="button"
      type={type}
      className={buttonClassName}
      {...props}
    >
      {children}
    </button>
  );
}
