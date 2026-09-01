import { createFileRoute } from "@tanstack/react-router";
import { Shell } from "@/components/layout/Shell";
import { HomeScreen } from "@/components/screens/HomeScreen";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <Shell>
      <HomeScreen />
    </Shell>
  );
}
