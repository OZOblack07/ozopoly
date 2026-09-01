export function formatNaira(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const n = Math.abs(Math.round(amount));
  return `${sign}₦${n.toLocaleString("en-NG")}`;
}

export function formatNairaCompact(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const n = Math.abs(Math.round(amount));
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    const s = m >= 10 ? m.toFixed(0) : m.toFixed(1).replace(/\.0$/, "");
    return `${sign}₦${s}M`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    const s = k >= 10 ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, "");
    return `${sign}₦${s}K`;
  }
  return `${sign}₦${n}`;
}

export function netWorth(
  money: number,
  owned: { price: number; level: number; mortgaged: boolean; buildCost: number }[],
): number {
  let total = money;
  for (const p of owned) {
    if (p.mortgaged) total += Math.floor(p.price / 2);
    else total += p.price + p.level * p.buildCost;
  }
  return total;
}
