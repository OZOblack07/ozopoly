import {
  Bolt,
  Car,
  Crown,
  Diamond,
  Rocket,
  Sailboat,
  Sparkles,
  Zap,
} from "lucide-react";
import type { TokenId } from "@/lib/game/types";
import { cn } from "@/lib/utils";

const MAP: Record<TokenId, typeof Crown> = {
  crown: Crown,
  rocket: Rocket,
  diamond: Diamond,
  car: Car,
  ship: Sailboat,
  dragon: Sparkles,
  lion: Zap,
  bolt: Bolt,
};

export function TokenGlyph({
  token,
  className,
  color,
}: {
  token: TokenId;
  className?: string;
  color?: string;
}) {
  const Icon = MAP[token] ?? Crown;
  return <Icon className={cn("size-4", className)} style={{ color }} strokeWidth={2.1} />;
}

export const TOKEN_LABEL: Record<TokenId, string> = {
  crown: "Crown",
  rocket: "Rocket",
  diamond: "Diamond",
  car: "Aero",
  ship: "Clipper",
  dragon: "Spark",
  lion: "Pulse",
  bolt: "Bolt",
};
