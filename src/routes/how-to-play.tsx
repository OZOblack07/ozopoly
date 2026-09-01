import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/layout/Shell";
import { Button } from "@/components/ui/Button";

export const Route = createFileRoute("/how-to-play")({ component: HowTo });

const STEPS = [
  {
    title: "Roll",
    body: "On your turn, roll both dice. Your token walks each space — it never teleports. Doubles grant another roll; three doubles send you to Timeout Zone.",
  },
  {
    title: "Move",
    body: "Land on Launch Pad or pass it to collect a launch bonus. Detour forces Timeout Zone. Chill Zone is safe. Lucky Break and Ozo Fund draw event cards.",
  },
  {
    title: "Buy",
    body: "Unowned streets, hubs, and utilities can be purchased. Pass if you want to keep cash for later districts.",
  },
  {
    title: "Rent",
    body: "Landing on a rival's property pays rent. Complete a color district to double undeveloped rent, then upgrade toward a skyscraper.",
  },
  {
    title: "Upgrade",
    body: "Own every title in a district, then build evenly: house, house, luxury house, tower, skyscraper. Rent climbs with each level.",
  },
  {
    title: "Trade",
    body: "On your turn, offer titles and cash. Both players must confirm. Sell upgrades before trading a developed lot.",
  },
  {
    title: "Manage",
    body: "Short on cash? Mortgage titles or sell upgrades. If you still cannot pay, you are eliminated and your assets transfer.",
  },
  {
    title: "Win",
    body: "Bankrupt every rival. The last standing player is the Ozopoly Champion.",
  },
];

function HowTo() {
  return (
    <Shell>
      <h1 className="font-display text-3xl">How to play</h1>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Ozopoly is an original property-trading game. Walk the board, control districts, and drain every rival dry.
      </p>
      <ol className="mt-8 grid gap-4 sm:grid-cols-2">
        {STEPS.map((s, i) => (
          <li key={s.title} className="oz-panel rounded-[28px] p-5">
            <p className="text-[11px] tracking-[0.2em] text-gold uppercase">Step {i + 1}</p>
            <h2 className="mt-2 font-display text-xl">{s.title}</h2>
            <p className="mt-2 text-sm text-muted">{s.body}</p>
          </li>
        ))}
      </ol>
      <Link to="/" className="mt-8 inline-block">
        <Button>Play now</Button>
      </Link>
    </Shell>
  );
}
