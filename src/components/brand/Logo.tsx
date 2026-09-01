import { cn } from "@/lib/utils";

export function Logo({ className, mark = true }: { className?: string; mark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-display tracking-tight", className)}>
      {mark && (
        <svg viewBox="0 0 32 32" className="size-[1.15em]" aria-hidden="true">
          <rect x="2" y="2" width="28" height="28" rx="8" fill="#e4c37a" />
          <rect x="6" y="6" width="20" height="20" rx="5" fill="#10131c" />
          <circle cx="12" cy="13" r="2" fill="#5eead4" />
          <circle cx="20" cy="13" r="2" fill="#5eead4" />
          <circle cx="16" cy="20" r="2" fill="#e4c37a" />
        </svg>
      )}
      <span>
        OZO<span className="text-gold">POLY</span>
      </span>
    </span>
  );
}
