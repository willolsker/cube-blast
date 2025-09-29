import { HydrateClient } from "~/trpc/server";
import { Game } from "./_components/game/Game";

export default async function Home() {
  return (
    <HydrateClient>
      <Game />
    </HydrateClient>
  );
}
