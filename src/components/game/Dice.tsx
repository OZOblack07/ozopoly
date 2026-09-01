import { cn } from "@/lib/utils";

const FACE_ROT: Record<number, string> = {
  1: "rotateX(0deg) rotateY(0deg)",
  2: "rotateY(-90deg)",
  3: "rotateY(180deg)",
  4: "rotateY(90deg)",
  5: "rotateX(-90deg)",
  6: "rotateX(90deg)",
};

export function Dice({
  value,
  rolling,
  size = 72,
}: {
  value: number;
  rolling: boolean;
  size?: number;
}) {
  const v = Math.min(6, Math.max(1, value || 1));
  return (
    <div className="dice-scene" style={{ width: size, height: size }} aria-hidden>
      <div
        className={cn("dice-cube", rolling && "rolling")}
        style={{
          transform: rolling ? undefined : FACE_ROT[v],
        }}
      >
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <div key={n} className="dice-face">
            {n}
          </div>
        ))}
      </div>
    </div>
  );
}
