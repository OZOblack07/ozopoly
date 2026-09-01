import type { ColorGroup, TileDef } from "./types";

export const BOARD: TileDef[] = [
  { id: 0, name: "Launch Pad", kind: "launch", short: "LAUNCH" },
  {
    id: 1,
    name: "Sunrise Avenue",
    kind: "property",
    group: "ember",
    price: 60_000,
    rents: [2_000, 10_000, 30_000, 90_000, 160_000, 250_000],
    buildCost: 50_000,
    short: "SUNRISE",
  },
  { id: 2, name: "Ozo Fund", kind: "fund", short: "FUND" },
  {
    id: 3,
    name: "Emerald Street",
    kind: "property",
    group: "ember",
    price: 60_000,
    rents: [4_000, 20_000, 60_000, 180_000, 320_000, 450_000],
    buildCost: 50_000,
    short: "EMERALD",
  },
  { id: 4, name: "City Levy", kind: "tax", tax: 200_000, short: "LEVY" },
  {
    id: 5,
    name: "Transit Hub Alpha",
    kind: "transit",
    group: "transit",
    price: 200_000,
    rents: [25_000, 50_000, 100_000, 200_000],
    short: "HUB α",
  },
  {
    id: 6,
    name: "Nova Road",
    kind: "property",
    group: "azure",
    price: 100_000,
    rents: [6_000, 30_000, 90_000, 270_000, 400_000, 550_000],
    buildCost: 50_000,
    short: "NOVA",
  },
  { id: 7, name: "Lucky Break", kind: "lucky", short: "LUCKY" },
  {
    id: 8,
    name: "Royal Crescent",
    kind: "property",
    group: "azure",
    price: 100_000,
    rents: [6_000, 30_000, 90_000, 270_000, 400_000, 550_000],
    buildCost: 50_000,
    short: "CRESCENT",
  },
  {
    id: 9,
    name: "Harbor Lane",
    kind: "property",
    group: "azure",
    price: 120_000,
    rents: [8_000, 40_000, 100_000, 300_000, 450_000, 600_000],
    buildCost: 50_000,
    short: "HARBOR",
  },
  { id: 10, name: "Timeout Zone", kind: "timeout", short: "TIMEOUT" },
  {
    id: 11,
    name: "Silicon Square",
    kind: "property",
    group: "orchid",
    price: 140_000,
    rents: [10_000, 50_000, 150_000, 450_000, 625_000, 750_000],
    buildCost: 100_000,
    short: "SILICON",
  },
  {
    id: 12,
    name: "Power Grid",
    kind: "utility",
    group: "utility",
    price: 150_000,
    short: "POWER",
  },
  {
    id: 13,
    name: "Innovation Avenue",
    kind: "property",
    group: "orchid",
    price: 140_000,
    rents: [10_000, 50_000, 150_000, 450_000, 625_000, 750_000],
    buildCost: 100_000,
    short: "INNOVATE",
  },
  {
    id: 14,
    name: "Tech Boulevard",
    kind: "property",
    group: "orchid",
    price: 160_000,
    rents: [12_000, 60_000, 180_000, 500_000, 700_000, 900_000],
    buildCost: 100_000,
    short: "TECH BLVD",
  },
  {
    id: 15,
    name: "Transit Hub Beta",
    kind: "transit",
    group: "transit",
    price: 200_000,
    rents: [25_000, 50_000, 100_000, 200_000],
    short: "HUB β",
  },
  {
    id: 16,
    name: "Venture Street",
    kind: "property",
    group: "amber",
    price: 180_000,
    rents: [14_000, 70_000, 200_000, 550_000, 750_000, 950_000],
    buildCost: 100_000,
    short: "VENTURE",
  },
  { id: 17, name: "Ozo Fund", kind: "fund", short: "FUND" },
  {
    id: 18,
    name: "Pulse Plaza",
    kind: "property",
    group: "amber",
    price: 180_000,
    rents: [14_000, 70_000, 200_000, 550_000, 750_000, 950_000],
    buildCost: 100_000,
    short: "PULSE",
  },
  {
    id: 19,
    name: "Foundry Row",
    kind: "property",
    group: "amber",
    price: 200_000,
    rents: [16_000, 80_000, 220_000, 600_000, 800_000, 1_000_000],
    buildCost: 100_000,
    short: "FOUNDRY",
  },
  { id: 20, name: "Chill Zone", kind: "chill", short: "CHILL" },
  {
    id: 21,
    name: "Cinema City",
    kind: "property",
    group: "crimson",
    price: 220_000,
    rents: [18_000, 90_000, 250_000, 700_000, 875_000, 1_050_000],
    buildCost: 150_000,
    short: "CINEMA",
  },
  { id: 22, name: "Lucky Break", kind: "lucky", short: "LUCKY" },
  {
    id: 23,
    name: "Music Avenue",
    kind: "property",
    group: "crimson",
    price: 220_000,
    rents: [18_000, 90_000, 250_000, 700_000, 875_000, 1_050_000],
    buildCost: 150_000,
    short: "MUSIC",
  },
  {
    id: 24,
    name: "Game District",
    kind: "property",
    group: "crimson",
    price: 240_000,
    rents: [20_000, 100_000, 300_000, 750_000, 925_000, 1_100_000],
    buildCost: 150_000,
    short: "GAMES",
  },
  {
    id: 25,
    name: "Transit Hub Gamma",
    kind: "transit",
    group: "transit",
    price: 200_000,
    rents: [25_000, 50_000, 100_000, 200_000],
    short: "HUB γ",
  },
  {
    id: 26,
    name: "Festival Square",
    kind: "property",
    group: "solar",
    price: 260_000,
    rents: [22_000, 110_000, 330_000, 800_000, 975_000, 1_150_000],
    buildCost: 150_000,
    short: "FESTIVAL",
  },
  {
    id: 27,
    name: "Spotlight Street",
    kind: "property",
    group: "solar",
    price: 260_000,
    rents: [22_000, 110_000, 330_000, 800_000, 975_000, 1_150_000],
    buildCost: 150_000,
    short: "SPOTLIGHT",
  },
  {
    id: 28,
    name: "Aqua Network",
    kind: "utility",
    group: "utility",
    price: 150_000,
    short: "AQUA",
  },
  {
    id: 29,
    name: "Neon Nights",
    kind: "property",
    group: "solar",
    price: 280_000,
    rents: [24_000, 120_000, 360_000, 850_000, 1_025_000, 1_200_000],
    buildCost: 150_000,
    short: "NEON",
  },
  { id: 30, name: "Detour", kind: "detour", short: "DETOUR" },
  {
    id: 31,
    name: "Diamond Heights",
    kind: "property",
    group: "jade",
    price: 300_000,
    rents: [26_000, 130_000, 390_000, 900_000, 1_100_000, 1_275_000],
    buildCost: 200_000,
    short: "DIAMOND",
  },
  {
    id: 32,
    name: "Golden Coast",
    kind: "property",
    group: "jade",
    price: 300_000,
    rents: [26_000, 130_000, 390_000, 900_000, 1_100_000, 1_275_000],
    buildCost: 200_000,
    short: "GOLDEN",
  },
  { id: 33, name: "Ozo Fund", kind: "fund", short: "FUND" },
  {
    id: 34,
    name: "Billionaire Boulevard",
    kind: "property",
    group: "jade",
    price: 320_000,
    rents: [28_000, 150_000, 450_000, 1_000_000, 1_200_000, 1_400_000],
    buildCost: 200_000,
    short: "BILLION",
  },
  {
    id: 35,
    name: "Transit Hub Delta",
    kind: "transit",
    group: "transit",
    price: 200_000,
    rents: [25_000, 50_000, 100_000, 200_000],
    short: "HUB δ",
  },
  { id: 36, name: "Lucky Break", kind: "lucky", short: "LUCKY" },
  {
    id: 37,
    name: "Prestige Avenue",
    kind: "property",
    group: "royal",
    price: 350_000,
    rents: [35_000, 175_000, 500_000, 1_100_000, 1_300_000, 1_500_000],
    buildCost: 200_000,
    short: "PRESTIGE",
  },
  { id: 38, name: "Luxury Levy", kind: "tax", tax: 100_000, short: "LUXURY" },
  {
    id: 39,
    name: "Crown Estate",
    kind: "property",
    group: "royal",
    price: 400_000,
    rents: [50_000, 200_000, 600_000, 1_400_000, 1_700_000, 2_000_000],
    buildCost: 200_000,
    short: "CROWN",
  },
];

export const GROUP_META: Record<
  ColorGroup,
  { label: string; color: string; ids: number[] }
> = {
  ember: { label: "Starter District", color: "#9a5b3c", ids: [1, 3] },
  azure: { label: "Harbor District", color: "#5ba3d9", ids: [6, 8, 9] },
  orchid: { label: "Business District", color: "#c46bb0", ids: [11, 13, 14] },
  amber: { label: "Venture District", color: "#e08a3c", ids: [16, 18, 19] },
  crimson: { label: "Entertainment District", color: "#d4454a", ids: [21, 23, 24] },
  solar: { label: "Festival District", color: "#e0c14a", ids: [26, 27, 29] },
  jade: { label: "Luxury District", color: "#3d9a6a", ids: [31, 32, 34] },
  royal: { label: "Prestige District", color: "#3b5bcc", ids: [37, 39] },
  transit: { label: "Transit Network", color: "#9aa3b2", ids: [5, 15, 25, 35] },
  utility: { label: "City Utilities", color: "#6ee0c4", ids: [12, 28] },
};

export function tileById(id: number): TileDef {
  const t = BOARD[id];
  if (!t) throw new Error(`Unknown tile ${id}`);
  return t;
}

export function groupTiles(group: ColorGroup): TileDef[] {
  return GROUP_META[group].ids.map(tileById);
}

export function tileGridPos(index: number): { row: number; col: number } {
  const i = ((index % 40) + 40) % 40;
  if (i <= 10) return { row: 11, col: 11 - i };
  if (i <= 20) return { row: 11 - (i - 10), col: 1 };
  if (i <= 30) return { row: 1, col: 1 + (i - 20) };
  return { row: 1 + (i - 30), col: 11 };
}

export function pathTiles(from: number, steps: number): number[] {
  const path: number[] = [];
  for (let i = 1; i <= steps; i++) path.push((from + i) % 40);
  return path;
}

export function shortestForward(from: number, to: number): number {
  return (to - from + 40) % 40;
}

export const OWNABLE_KINDS: TileDef["kind"][] = ["property", "transit", "utility"];
