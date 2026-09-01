export type CardEffect =
  | { kind: "collect"; amount: number }
  | { kind: "pay"; amount: number }
  | { kind: "collect-each"; amount: number }
  | { kind: "pay-each"; amount: number }
  | { kind: "repairs"; perHouse: number; perTower: number }
  | { kind: "go-to"; tileId: number; collectLaunch: boolean }
  | { kind: "go-relative"; steps: number }
  | { kind: "timeout" }
  | { kind: "get-out" }
  | { kind: "double-rent" }
  | { kind: "festival"; amount: number };

export interface EventCard {
  id: string;
  title: string;
  body: string;
  deck: "lucky" | "fund";
  effect: CardEffect;
}

export const LUCKY_CARDS: EventCard[] = [
  {
    id: "l1",
    title: "Market Boom",
    body: "A late-night rally pays off. Collect ₦150,000.",
    deck: "lucky",
    effect: { kind: "collect", amount: 150_000 },
  },
  {
    id: "l2",
    title: "Lucky Investment",
    body: "Your next rent collection is doubled.",
    deck: "lucky",
    effect: { kind: "double-rent" },
  },
  {
    id: "l3",
    title: "Free Travel",
    body: "Advance to Launch Pad. Collect the launch bonus.",
    deck: "lucky",
    effect: { kind: "go-to", tileId: 0, collectLaunch: true },
  },
  {
    id: "l4",
    title: "Skyline Express",
    body: "Advance to Diamond Heights.",
    deck: "lucky",
    effect: { kind: "go-to", tileId: 31, collectLaunch: true },
  },
  {
    id: "l5",
    title: "Red Carpet",
    body: "Advance to Cinema City.",
    deck: "lucky",
    effect: { kind: "go-to", tileId: 21, collectLaunch: true },
  },
  {
    id: "l6",
    title: "Wrong Turn",
    body: "Detour. Go to Timeout Zone. Do not collect a launch bonus.",
    deck: "lucky",
    effect: { kind: "timeout" },
  },
  {
    id: "l7",
    title: "Speeding Fine",
    body: "Pay ₦30,000.",
    deck: "lucky",
    effect: { kind: "pay", amount: 30_000 },
  },
  {
    id: "l8",
    title: "Transit Upgrade",
    body: "Advance to Transit Hub Alpha.",
    deck: "lucky",
    effect: { kind: "go-to", tileId: 5, collectLaunch: true },
  },
  {
    id: "l9",
    title: "Get Out of Timeout",
    body: "Keep this card. Use it to leave Timeout Zone free.",
    deck: "lucky",
    effect: { kind: "get-out" },
  },
  {
    id: "l10",
    title: "Backtrack",
    body: "Go back three spaces.",
    deck: "lucky",
    effect: { kind: "go-relative", steps: -3 },
  },
  {
    id: "l11",
    title: "Crown Invitation",
    body: "Advance to Crown Estate.",
    deck: "lucky",
    effect: { kind: "go-to", tileId: 39, collectLaunch: true },
  },
  {
    id: "l12",
    title: "Building Inspection",
    body: "Pay ₦25,000 per house and ₦100,000 per skyscraper.",
    deck: "lucky",
    effect: { kind: "repairs", perHouse: 25_000, perTower: 100_000 },
  },
  {
    id: "l13",
    title: "Chairman Dividend",
    body: "Collect ₦50,000 from every rival.",
    deck: "lucky",
    effect: { kind: "collect-each", amount: 50_000 },
  },
  {
    id: "l14",
    title: "Night Market",
    body: "Collect ₦80,000.",
    deck: "lucky",
    effect: { kind: "collect", amount: 80_000 },
  },
  {
    id: "l15",
    title: "Harbor Wind",
    body: "Advance to Harbor Lane.",
    deck: "lucky",
    effect: { kind: "go-to", tileId: 9, collectLaunch: true },
  },
  {
    id: "l16",
    title: "Turbo Boost",
    body: "Advance to Chill Zone.",
    deck: "lucky",
    effect: { kind: "go-to", tileId: 20, collectLaunch: true },
  },
];

export const FUND_CARDS: EventCard[] = [
  {
    id: "f1",
    title: "Tax Audit",
    body: "Pay ₦80,000.",
    deck: "fund",
    effect: { kind: "pay", amount: 80_000 },
  },
  {
    id: "f2",
    title: "City Festival",
    body: "Every player collects ₦30,000 from the bank.",
    deck: "fund",
    effect: { kind: "festival", amount: 30_000 },
  },
  {
    id: "f3",
    title: "Business Partnership",
    body: "Collect ₦25,000 from every rival.",
    deck: "fund",
    effect: { kind: "collect-each", amount: 25_000 },
  },
  {
    id: "f4",
    title: "Grant Approved",
    body: "Collect ₦100,000.",
    deck: "fund",
    effect: { kind: "collect", amount: 100_000 },
  },
  {
    id: "f5",
    title: "Hospital Bill",
    body: "Pay ₦50,000.",
    deck: "fund",
    effect: { kind: "pay", amount: 50_000 },
  },
  {
    id: "f6",
    title: "School Fund",
    body: "Pay ₦40,000.",
    deck: "fund",
    effect: { kind: "pay", amount: 40_000 },
  },
  {
    id: "f7",
    title: "Beauty Prize",
    body: "Collect ₦20,000.",
    deck: "fund",
    effect: { kind: "collect", amount: 20_000 },
  },
  {
    id: "f8",
    title: "Life Insurance",
    body: "Collect ₦100,000.",
    deck: "fund",
    effect: { kind: "collect", amount: 100_000 },
  },
  {
    id: "f9",
    title: "Income Tax Refund",
    body: "Collect ₦40,000.",
    deck: "fund",
    effect: { kind: "collect", amount: 40_000 },
  },
  {
    id: "f10",
    title: "Street Repairs",
    body: "Pay ₦40,000 per house and ₦115,000 per skyscraper.",
    deck: "fund",
    effect: { kind: "repairs", perHouse: 40_000, perTower: 115_000 },
  },
  {
    id: "f11",
    title: "Launch Day",
    body: "Advance to Launch Pad. Collect the launch bonus.",
    deck: "fund",
    effect: { kind: "go-to", tileId: 0, collectLaunch: true },
  },
  {
    id: "f12",
    title: "Timeout Notice",
    body: "Go to Timeout Zone. Do not collect a launch bonus.",
    deck: "fund",
    effect: { kind: "timeout" },
  },
  {
    id: "f13",
    title: "Get Out of Timeout",
    body: "Keep this card. Use it to leave Timeout Zone free.",
    deck: "fund",
    effect: { kind: "get-out" },
  },
  {
    id: "f14",
    title: "Birthday",
    body: "Collect ₦20,000 from every rival.",
    deck: "fund",
    effect: { kind: "collect-each", amount: 20_000 },
  },
  {
    id: "f15",
    title: "Consultancy Fee",
    body: "Collect ₦50,000.",
    deck: "fund",
    effect: { kind: "collect", amount: 50_000 },
  },
  {
    id: "f16",
    title: "Charity Gala",
    body: "Pay ₦20,000 to each rival.",
    deck: "fund",
    effect: { kind: "pay-each", amount: 20_000 },
  },
];

export const ALL_CARDS: Record<string, EventCard> = Object.fromEntries(
  [...LUCKY_CARDS, ...FUND_CARDS].map((c) => [c.id, c]),
);

export function cardById(id: string): EventCard {
  const c = ALL_CARDS[id];
  if (!c) throw new Error(`Unknown card ${id}`);
  return c;
}
