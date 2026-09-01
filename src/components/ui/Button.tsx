import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] px-4 text-sm font-medium transition-[transform,background-color,border-color,opacity] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] disabled:cursor-not-allowed disabled:opacity-40",
        "active:scale-[0.98]",
        variant === "primary" && "bg-gold text-gold-fg hover:brightness-105",
        variant === "secondary" &&
          "border border-line bg-bg-subtle text-fg hover:border-line-strong",
        variant === "ghost" && "text-muted hover:bg-bg-subtle hover:text-fg",
        variant === "danger" && "bg-danger text-bg hover:brightness-110",
        className,
      )}
      {...props}
    />
  );
}
