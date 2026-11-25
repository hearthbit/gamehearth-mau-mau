import { SeededRandom, applyMove, botMove, createMatch, randomStateFromSeed } from "@gamehearth/sdk/platform";
import { describe, expect, it } from "vitest";
import { mauMau, standardOptions, type MauMauAction, type Options } from "../src";
import { catalog, matchFrom, type MauMauMatch, type Table } from "./helpers";

const maxMoves = 3000;

const allOptions: Options[] = [false, true].flatMap((bubeAufBube) =>
  [true, false].flatMap((siebenerStapeln) => (["nochmal", "aussetzen"] as const).map((ass) => ({ bubeAufBube, siebenerStapeln, ass }))),
);

function botChoice(match: MauMauMatch, player = match.state.public.current): MauMauAction {
  const choice = botMove(mauMau, match, player, { now: 0, catalog });
  expect(choice.problem, JSON.stringify(choice)).toBeUndefined();
  expect(choice.chosen).toBe("bot");
  return choice.action as MauMauAction;
}

function apply(match: MauMauMatch, action: MauMauAction): MauMauMatch {
  const outcome = applyMove(mauMau, match, { player: match.state.public.current, action, now: 0 }, { catalog });
  if (!outcome.ok) {
    throw new Error(`${JSON.stringify(action)} rejected: ${outcome.error.code} ${outcome.error.message}`);
  }
  return outcome.match;
}

function start(playerCount: number, seed: string, options: Options): MauMauMatch {
  const created = createMatch(mauMau, { playerCount, seed, options, catalog });
  if (!created.ok) {
    throw new Error(created.error.message);
  }
  return created.match;
}

function botTable(table: Table, options: Options = standardOptions): MauMauAction {
  return botChoice(matchFrom(table, options));
}

describe("Bot", () => {
  it.each([2, 3, 4, 5, 6])("always picks a legal move and plays whenever it can, in random matches with %i players", (playerCount) => {
    let asked = 0;
    for (const [index, options] of allOptions.entries()) {
      for (let game = 0; game < 4; game++) {
        const seed = `bot-random-${playerCount}-${index}-${game}`;
        const walk = new SeededRandom(randomStateFromSeed(`walk-${seed}`));
        let match = start(playerCount, seed, options);
        for (let steps = 0; steps < maxMoves && match.result === undefined; steps++) {
          const legal = match.moves[match.state.public.current] ?? [];
          const action = botChoice(match);
          expect(legal).toContainEqual(action);
          if (legal.some((move) => move.type === "play")) {
            expect(action.type, seed).toBe("play");
          }
          asked += 1;
          match = apply(match, walk.pick(legal));
        }
      }
    }
    expect(asked).toBeGreaterThan(1000);
  });

  it.each([2, 3, 4, 5, 6])("finishes every match with %i bots, with every set of house rules", (playerCount) => {
    for (const [index, options] of allOptions.entries()) {
      for (let game = 0; game < 5; game++) {
        const seed = `bot-only-${playerCount}-${index}-${game}`;
        let match = start(playerCount, seed, options);
        let steps = 0;
        for (; steps < maxMoves && match.result === undefined; steps++) {
          match = apply(match, botChoice(match));
        }
        expect(match.result, `${seed} ${JSON.stringify(options)}`).toBeDefined();
        expect(steps).toBeLessThan(maxMoves);
      }
    }
  });

  it("wins more often than a player who picks a random legal move", () => {
    const games = 100;
    let wins = 0;
    for (let game = 0; game < games; game++) {
      const walk = new SeededRandom(randomStateFromSeed(`against-random-${game}`));
      let match = start(2, `against-random-${game}`, standardOptions);
      for (let steps = 0; steps < maxMoves && match.result === undefined; steps++) {
        const player = match.state.public.current;
        match = apply(match, player === "p1" ? botChoice(match) : walk.pick(match.moves[player] ?? []));
      }
      wins += match.result?.winners.includes("p1") === true ? 1 : 0;
    }
    expect(wins).toBeGreaterThan(games * 0.55);
  });

  it("chooses the same move again in the same situation", () => {
    const match = start(4, "same", standardOptions);
    expect(botChoice(match)).toEqual(botChoice(match));
  });

  it("only looks at what its own seat sees", () => {
    const table: Table = { hands: { p1: ["herz-K", "pik-9", "herz-D"], p2: ["karo-8", "kreuz-D", "pik-A"] }, discard: ["herz-9"], deck: ["kreuz-7", "pik-B"] };
    const other: Table = { ...table, hands: { ...table.hands, p2: ["herz-8", "herz-A", "karo-9"] }, deck: ["herz-7", "karo-B"] };
    expect(botTable(other)).toEqual(botTable(table));
  });

  it("plays a matching card instead of a jack and keeps the card that leaves the most options", () => {
    expect(botTable({ hands: { p1: ["pik-B", "herz-K"], p2: ["karo-8", "kreuz-D", "pik-A"] }, discard: ["herz-9"] })).toEqual({ type: "play", card: "herz-K" });
    expect(botTable({ hands: { p1: ["herz-K", "pik-9", "pik-D", "pik-10"], p2: ["karo-8", "kreuz-D", "pik-A"] }, discard: ["herz-9"] })).toEqual({
      type: "play",
      card: "pik-9",
    });
  });

  it("plays a jack when nothing else fits and wishes the suit it holds most", () => {
    expect(botTable({ hands: { p1: ["herz-B", "karo-7", "karo-K", "pik-9"], p2: ["karo-8", "kreuz-D", "pik-A"] }, discard: ["kreuz-10"] })).toEqual({
      type: "play",
      card: "herz-B",
      wish: "karo",
    });
  });

  it("plays its last card even if it is a jack", () => {
    expect(botTable({ hands: { p1: ["herz-B"], p2: ["karo-8", "kreuz-D", "pik-A"] }, discard: ["kreuz-10"] })).toMatchObject({ type: "play", card: "herz-B" });
  });

  it("stacks a 7 instead of drawing the penalty cards", () => {
    expect(botTable({ hands: { p1: ["pik-7", "herz-K"], p2: ["karo-8", "kreuz-D", "pik-A"] }, discard: ["herz-7"], penalty: 2 })).toEqual({ type: "play", card: "pik-7" });
  });

  it("plays the card it just drew when it fits", () => {
    let match = matchFrom({ hands: { p1: ["pik-K"], p2: ["karo-8", "kreuz-D", "pik-A"] }, discard: ["herz-9"], deck: ["herz-A"] });
    expect(botChoice(match)).toEqual({ type: "draw" });
    match = apply(match, { type: "draw" });
    expect(botChoice(match)).toEqual({ type: "play", card: "herz-A" });
  });

  it("puts a 7 on a player who is about to win", () => {
    expect(botTable({ hands: { p1: ["herz-7", "herz-K", "pik-K", "pik-D"], p2: ["karo-8"] }, discard: ["herz-9"] })).toEqual({ type: "play", card: "herz-7" });
  });

  it("follows the ace house rule: no lone ace on another turn, but an ace that skips is welcome", () => {
    const table: Table = { hands: { p1: ["herz-A", "pik-9", "kreuz-D"], p2: ["karo-8", "kreuz-K", "pik-A"] }, discard: ["herz-9"] };
    expect(botTable(table)).toEqual({ type: "play", card: "pik-9" });
    expect(botTable(table, { ...standardOptions, ass: "aussetzen" })).toEqual({ type: "play", card: "herz-A" });
  });

  it("plays an ace on another turn when it has a card to follow up", () => {
    expect(botTable({ hands: { p1: ["herz-A", "herz-8", "pik-9"], p2: ["karo-8", "kreuz-K", "pik-A"] }, discard: ["herz-9"] })).toEqual({ type: "play", card: "herz-A" });
  });
});
