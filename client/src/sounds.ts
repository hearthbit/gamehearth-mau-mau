import type { PlayerId, Sound } from "@gamehearth/sdk/client";
import type { Card, Options, Rank } from "../../src/index";
import { cardParts, type Snapshot } from "./view";

export const skippedSound: Sound = {
  notes: [
    { freq: 523, length: 0.07, volume: 0.4 },
    { freq: 392, at: 0.09, length: 0.12, volume: 0.4 },
  ],
};

export function drawSound(count: number): Sound {
  return {
    notes: Array.from({ length: Math.min(Math.max(count, 1), 4) }, (_, index) => ({
      freq: 1200,
      to: 500,
      at: index * 0.09,
      length: 0.06,
      wave: "triangle" as const,
      volume: 0.35,
    })),
  };
}

const specialRanks: readonly Rank[] = ["7", "8", "B", "A"];

export function soundFor(previous: Snapshot | undefined, next: Snapshot, options: Options): Sound | undefined {
  if (previous === undefined || previous.result !== undefined) {
    return undefined;
  }
  if (next.result !== undefined) {
    return next.result.winners.includes(next.player) ? "win" : "lose";
  }
  const me = next.player;
  const played = topOf(next) !== topOf(previous) ? topOf(next) : undefined;
  if (played !== undefined) {
    const rank = cardParts(played).rank;
    if (previous.me.hand.includes(played)) {
      return specialRanks.includes(rank) ? "coin" : "select";
    }
    if (rank === "7" && next.public.current === me && next.public.penalty > 0) {
      return "hit";
    }
    if (skips(rank, options) && previous.public.current !== me && seatAfter(next.players, previous.public.current) === me) {
      return skippedSound;
    }
  }
  if (next.public.current === me && previous.public.current !== me) {
    return "blip";
  }
  const drawn = next.me.hand.length - previous.me.hand.length;
  if (played === undefined && drawn > 0) {
    return drawSound(drawn);
  }
  return undefined;
}

function skips(rank: Rank, options: Options): boolean {
  return rank === "8" || (rank === "A" && options.ass === "aussetzen");
}

function topOf(snapshot: Snapshot): Card | undefined {
  return snapshot.public.discard[snapshot.public.discard.length - 1];
}

function seatAfter(seats: readonly PlayerId[], seat: PlayerId): PlayerId | undefined {
  const at = seats.indexOf(seat);
  return at < 0 ? undefined : seats[(at + 1) % seats.length];
}
