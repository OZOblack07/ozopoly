import type { Rng } from "./types";

export function createRng(): Rng {
  const unit = () => {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0]! / 2 ** 32;
  };
  const rng: Rng = {
    int(min, max) {
      if (max < min) throw new Error("rng.int: max < min");
      return min + Math.floor(unit() * (max - min + 1));
    },
    shuffle<T>(arr: T[]) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = rng.int(0, i);
        const tmp = a[i]!;
        a[i] = a[j]!;
        a[j] = tmp;
      }
      return a;
    },
  };
  return rng;
}
