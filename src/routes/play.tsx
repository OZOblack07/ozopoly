import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { GameView } from "@/components/game/GameView";
import { useLocalGame } from "@/lib/stores/local-game";
import { Shell } from "@/components/layout/Shell";
import { Button } from "@/components/ui/Button";
import { unlockAudio } from "@/lib/audio";
import { useEffect } from "react";

export const Route = createFileRoute("/play")({ component: Play });

function Play() {
  const navigate = useNavigate();
  const state = useLocalGame((s) => s.state);
  const meId = useLocalGame((s) => s.meId);
  const dispatch = useLocalGame((s) => s.dispatch);
  const runAiTurn = useLocalGame((s) => s.runAiTurn);
  const reset = useLocalGame((s) => s.reset);

  useEffect(() => {
    unlockAudio();
  }, []);

  if (!state) {
    return (
      <Shell>
        <div className="grid min-h-[60dvh] place-items-center text-center">
          <div>
            <p className="text-muted">No match in progress.</p>
            <Button className="mt-4" onClick={() => navigate({ to: "/" })}>
              Return home
            </Button>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell flush hideHeader>
      <GameView
        state={state}
        meId={meId}
        dispatch={async (action) => dispatch(action)}
        runAi={async () => runAiTurn()}
        onExit={() => {
          reset();
          void navigate({ to: "/" });
        }}
      />
    </Shell>
  );
}
