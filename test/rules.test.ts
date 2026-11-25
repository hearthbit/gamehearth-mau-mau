import { applyMove, createMatch } from "@gamehearth/sdk/platform";
import { describe, expect, it } from "vitest";
import { fullDeck, mauMau, standardOptions, startingHandSize } from "../src";
import { catalog, matchFrom, movesOf, play, playWithChanges, top, type Table } from "./helpers";

describe("Dealing", () => {
  it.each([2, 3, 4, 5, 6])("deals all 32 cards exactly once with %i players", (playerCount) => {
    const outcome = createMatch(mauMau, { playerCount, seed: `austeilen-${playerCount}` });
    if (!outcome.ok) throw new Error(outcome.error.message);
    const { state } = outcome.match;
    const hands = Object.values(state.players).map((own) => own.hand);
    for (const hand of hands) {
      expect(hand).toHaveLength(startingHandSize);
    }
    expect(state.public.discard).toHaveLength(1);
    expect(state.secret.deck).toHaveLength(32 - playerCount * startingHandSize - 1);
    expect([...hands.flat(), ...state.public.discard, ...state.secret.deck].sort()).toEqual([...fullDeck].sort());
    expect(state.public).toMatchObject({ current: "p1", phase: "play", wish: null, penalty: 0, stuck: 0 });
    expect(state.public.deckSize).toBe(state.secret.deck.length);
    expect(Object.values(state.public.handSizes)).toEqual(new Array(playerCount).fill(startingHandSize));
  });

  it("gives a face-up starting card no special effect", () => {
    const startSeven = matchFrom({ hands: { p1: ["herz-9", "pik-K"], p2: ["karo-9"] }, discard: ["herz-7"] });
    expect(movesOf(startSeven, "p1")).toEqual([{ type: "play", card: "herz-9" }]);
    const startJack = matchFrom({ hands: { p1: ["herz-9", "pik-B", "kreuz-9"], p2: ["karo-9"] }, discard: ["herz-B"] });
    expect(movesOf(startJack, "p1")).toEqual([{ type: "play", card: "herz-9" }]);
  });
});

describe("Matching", () => {
  const table = matchFrom({
    hands: { p1: ["herz-K", "pik-9", "pik-K"], p2: ["karo-8", "karo-D"], p3: ["kreuz-8"] },
    discard: ["herz-9"],
    deck: ["karo-A", "kreuz-A"],
  });

  it("offers only cards of the same suit or the same value", () => {
    expect(movesOf(table, "p1")).toEqual([
      { type: "play", card: "herz-K" },
      { type: "play", card: "pik-9" },
    ]);
  });

  it("gives moves only to the seat whose turn it is", () => {
    expect(movesOf(table, "p2")).toEqual([]);
    expect(movesOf(table, "p3")).toEqual([]);
  });

  it("plays the card and passes the turn on", () => {
    const next = play(table, "p1", { type: "play", card: "pik-9" });
    expect(top(next)).toBe("pik-9");
    expect(next.state.players["p1"]?.hand).toEqual(["herz-K", "pik-K"]);
    expect(next.state.public).toMatchObject({ current: "p2", handSizes: { p1: 2, p2: 2, p3: 1 } });
  });

  it("only allows drawing when nothing fits", () => {
    const stuck = matchFrom({ hands: { p1: ["pik-K"], p2: ["karo-8"] }, discard: ["herz-9"], deck: ["karo-A"] });
    expect(movesOf(stuck, "p1")).toEqual([{ type: "draw" }]);
  });
});

describe("Drawing", () => {
  it("takes a card and allows playing it right away if it fits", () => {
    const table = matchFrom({ hands: { p1: ["pik-K"], p2: ["karo-8"] }, discard: ["herz-9"], deck: ["kreuz-7", "herz-A"] });
    const drawn = play(table, "p1", { type: "draw" });
    expect(drawn.state.players["p1"]).toEqual({ hand: ["pik-K", "herz-A"], drawn: "herz-A" });
    expect(drawn.state.public).toMatchObject({ current: "p1", phase: "drawn", deckSize: 1 });
    expect(movesOf(drawn, "p1")).toEqual([{ type: "play", card: "herz-A" }, { type: "pass" }]);
  });

  it("only allows passing if the drawn card does not fit", () => {
    const table = matchFrom({ hands: { p1: ["pik-K"], p2: ["karo-8"] }, discard: ["herz-9"], deck: ["kreuz-7"] });
    const drawn = play(table, "p1", { type: "draw" });
    expect(movesOf(drawn, "p1")).toEqual([{ type: "pass" }]);
    const passed = play(drawn, "p1", { type: "pass" });
    expect(passed.state.public).toMatchObject({ current: "p2", phase: "play" });
    expect(passed.state.players["p1"]).toEqual({ hand: ["pik-K", "kreuz-7"], drawn: null });
  });

  it("does not reveal publicly whether the drawn card fits", () => {
    const fitting = play(matchFrom({ hands: { p1: ["pik-K"], p2: ["karo-8"] }, discard: ["herz-9"], deck: ["herz-A"] }), "p1", {
      type: "draw",
    });
    const notFitting = play(matchFrom({ hands: { p1: ["pik-K"], p2: ["karo-8"] }, discard: ["herz-9"], deck: ["kreuz-7"] }), "p1", {
      type: "draw",
    });
    expect(fitting.state.public).toEqual(notFitting.state.public);
  });

  it("reshuffles the discard pile except its top card when the draw pile is empty", () => {
    const table = matchFrom({
      hands: { p1: ["pik-K"], p2: ["karo-8"] },
      discard: ["kreuz-7", "kreuz-8", "kreuz-D", "herz-9"],
      deck: [],
    });
    const drawn = play(table, "p1", { type: "draw" });
    expect(drawn.state.public.discard).toEqual(["herz-9"]);
    expect(drawn.state.public.deckSize).toBe(2);
    const own = drawn.state.players["p1"];
    expect(["kreuz-7", "kreuz-8", "kreuz-D"]).toContain(own?.drawn);
    expect([...(own?.hand ?? []), ...drawn.state.secret.deck].sort()).toEqual(["kreuz-7", "kreuz-8", "kreuz-D", "pik-K"].sort());
  });
});

describe("7", () => {
  const table = matchFrom({
    hands: { p1: ["herz-7", "pik-K"], p2: ["pik-7", "herz-K"], p3: ["karo-9", "kreuz-7"] },
    discard: ["herz-9"],
    deck: ["kreuz-A", "kreuz-K", "kreuz-D", "kreuz-B", "karo-A"],
  });

  it("makes the next player draw 2 cards or play a 7 on top", () => {
    const next = play(table, "p1", { type: "play", card: "herz-7" });
    expect(next.state.public).toMatchObject({ current: "p2", penalty: 2 });
    expect(movesOf(next, "p2")).toEqual([{ type: "play", card: "pik-7" }, { type: "draw" }]);
  });

  it("adds up stacked 7s, and whoever draws is done afterwards", () => {
    let match = play(table, "p1", { type: "play", card: "herz-7" });
    match = play(match, "p2", { type: "play", card: "pik-7" });
    expect(match.state.public).toMatchObject({ current: "p3", penalty: 4 });
    expect(movesOf(match, "p3")).toEqual([{ type: "play", card: "kreuz-7" }, { type: "draw" }]);
    match = play(match, "p3", { type: "draw" });
    expect(match.state.players["p3"]?.hand).toHaveLength(6);
    expect(match.state.public).toMatchObject({ current: "p1", penalty: 0, phase: "play" });
  });

  it("gives only as many penalty cards as are left", () => {
    const short = matchFrom({
      hands: { p1: ["herz-K"], p2: ["pik-K", "pik-D"] },
      discard: ["herz-7"],
      deck: ["kreuz-A"],
      current: "p2",
      penalty: 4,
    });
    const after = play(short, "p2", { type: "draw" });
    expect(after.state.players["p2"]?.hand).toHaveLength(3);
    expect(after.state.public).toMatchObject({ penalty: 0, current: "p1", deckSize: 0 });
  });
});

describe("8", () => {
  it("skips the next player with three players", () => {
    const table = matchFrom({ hands: { p1: ["herz-8", "pik-K"], p2: ["herz-K"], p3: ["karo-K"] }, discard: ["herz-9"] });
    expect(play(table, "p1", { type: "play", card: "herz-8" }).state.public.current).toBe("p3");
  });

  it("gives the same player another turn with two players", () => {
    const table = matchFrom({ hands: { p1: ["herz-8", "pik-K"], p2: ["herz-K"] }, discard: ["herz-9"] });
    expect(play(table, "p1", { type: "play", card: "herz-8" }).state.public.current).toBe("p1");
  });
});

describe("Jack", () => {
  const table = matchFrom({
    hands: { p1: ["pik-B", "herz-K"], p2: ["kreuz-B", "karo-9", "karo-K", "herz-D"] },
    discard: ["herz-9"],
    deck: ["kreuz-A"],
  });

  it("may be played on any card and offers one move per wished suit", () => {
    expect(movesOf(table, "p1")).toEqual([
      { type: "play", card: "pik-B", wish: "kreuz" },
      { type: "play", card: "pik-B", wish: "pik" },
      { type: "play", card: "pik-B", wish: "herz" },
      { type: "play", card: "pik-B", wish: "karo" },
      { type: "play", card: "herz-K" },
    ]);
  });

  it("then requires the wished suit and forbids jack on jack", () => {
    const wished = play(table, "p1", { type: "play", card: "pik-B", wish: "karo" });
    expect(wished.state.public).toMatchObject({ wish: "karo", current: "p2" });
    expect(movesOf(wished, "p2")).toEqual([
      { type: "play", card: "karo-9" },
      { type: "play", card: "karo-K" },
    ]);
  });

  it("clears the wish as soon as a card has been played on it", () => {
    const wished = play(table, "p1", { type: "play", card: "pik-B", wish: "karo" });
    expect(play(wished, "p2", { type: "play", card: "karo-9" }).state.public.wish).toBeNull();
  });

  it("allows drawing when the wished suit is missing", () => {
    const wished = play(table, "p1", { type: "play", card: "pik-B", wish: "pik" });
    expect(movesOf(wished, "p2")).toEqual([{ type: "draw" }]);
  });
});

describe("Ace", () => {
  const table = matchFrom({
    hands: { p1: ["herz-A", "pik-A", "pik-9", "karo-K"], p2: ["karo-D", "kreuz-D"] },
    discard: ["herz-9"],
    deck: ["kreuz-K"],
  });

  it("requires another matching card after an ace, without passing", () => {
    const ace = play(table, "p1", { type: "play", card: "herz-A" });
    expect(ace.state.public).toMatchObject({ current: "p1", phase: "play" });
    expect(movesOf(ace, "p1")).toEqual([{ type: "play", card: "pik-A" }]);
    expect(movesOf(ace, "p2")).toEqual([]);
  });

  it("allows ace on ace and then requires a card of the new suit", () => {
    let match = play(table, "p1", { type: "play", card: "herz-A" });
    match = play(match, "p1", { type: "play", card: "pik-A" });
    expect(match.state.public).toMatchObject({ current: "p1", phase: "play" });
    expect(movesOf(match, "p1")).toEqual([{ type: "play", card: "pik-9" }]);
    match = play(match, "p1", { type: "play", card: "pik-9" });
    expect(match.state.public).toMatchObject({ current: "p2", phase: "play" });
  });

  it("allows drawing a card after an ace when nothing fits, and playing a fitting one right away", () => {
    const lucky = matchFrom({
      hands: { p1: ["herz-A", "karo-K"], p2: ["karo-D"] },
      discard: ["herz-9"],
      deck: ["herz-D"],
    });
    let match = play(lucky, "p1", { type: "play", card: "herz-A" });
    expect(movesOf(match, "p1")).toEqual([{ type: "draw" }]);
    match = play(match, "p1", { type: "draw" });
    expect(match.state.public).toMatchObject({ current: "p1", phase: "drawn" });
    expect(movesOf(match, "p1")).toEqual([{ type: "play", card: "herz-D" }, { type: "pass" }]);
    match = play(match, "p1", { type: "play", card: "herz-D" });
    expect(match.state.public).toMatchObject({ current: "p2", phase: "play" });
  });

  it("passes on to the next player after drawing if the drawn card does not fit either", () => {
    const unlucky = matchFrom({
      hands: { p1: ["herz-A", "karo-K"], p2: ["karo-D"] },
      discard: ["herz-9"],
      deck: ["kreuz-D"],
    });
    let match = play(play(unlucky, "p1", { type: "play", card: "herz-A" }), "p1", { type: "draw" });
    expect(movesOf(match, "p1")).toEqual([{ type: "pass" }]);
    match = play(match, "p1", { type: "pass" });
    expect(match.state.public).toMatchObject({ current: "p2", phase: "play" });
    expect(match.state.players["p1"]?.hand).toEqual(["karo-K", "kreuz-D"]);
  });

  it("works like a normal 7 when followed up with a 7", () => {
    const sevens = matchFrom({ hands: { p1: ["herz-A", "herz-7", "pik-K"], p2: ["karo-D"] }, discard: ["herz-9"] });
    const match = play(play(sevens, "p1", { type: "play", card: "herz-A" }), "p1", { type: "play", card: "herz-7" });
    expect(match.state.public).toMatchObject({ current: "p2", penalty: 2 });
  });
});

describe("End", () => {
  it.each([
    ["a normal card", "herz-K"],
    ["an ace", "herz-A"],
    ["an 8", "herz-8"],
    ["a jack", "herz-B"],
  ] as const)("ends the match when someone plays %s as their last card", (_name, card) => {
    const table = matchFrom({ hands: { p1: [card], p2: ["karo-D"] }, discard: ["herz-9"] });
    const action = card === "herz-B" ? { type: "play" as const, card, wish: "pik" as const } : { type: "play" as const, card };
    const { match: finished, changes } = playWithChanges(table, "p1", action, { p1: { items: {}, stats: { siege: 4 }, flags: {} } });
    expect(finished.result).toEqual({ winners: ["p1"] });
    expect(changes).toEqual([{ player: "p1", op: "stat", id: "siege", value: 1 }]);
    expect(applyMove(mauMau, finished, { player: "p2", action: { type: "draw" }, now: 0 }, { catalog }).ok).toBe(false);
  });

  it("gives no win while the match is running", () => {
    const table = matchFrom({ hands: { p1: ["herz-K", "herz-D"], p2: ["karo-D"] }, discard: ["herz-9"] });
    const { match, changes } = playWithChanges(table, "p1", { type: "play", card: "herz-K" });
    expect(match.result).toBeUndefined();
    expect(changes).toEqual([]);
  });

  it("ends when nobody can play or draw any more, and gives the win to the fewest cards", () => {
    let match = matchFrom({
      hands: { p1: ["pik-K", "pik-D"], p2: ["kreuz-K"], p3: ["karo-K", "karo-D", "kreuz-8"] },
      discard: ["herz-9"],
      deck: [],
    });
    for (const player of ["p1", "p2"]) {
      expect(movesOf(match, player)).toEqual([{ type: "draw" }]);
      match = play(match, player, { type: "draw" });
      expect(match.result).toBeUndefined();
    }
    const last = playWithChanges(match, "p3", { type: "draw" });
    expect(last.match.result).toEqual({ winners: ["p2"] });
    expect(last.changes).toEqual([{ player: "p2", op: "stat", id: "siege", value: 1 }]);
  });

  it("gives a win to everyone with the fewest cards in a tie", () => {
    let match = matchFrom({
      hands: { p1: ["pik-K"], p2: ["kreuz-K"], p3: ["karo-K", "karo-D"] },
      discard: ["herz-9"],
      deck: [],
    });
    match = play(match, "p1", { type: "draw" });
    match = play(match, "p2", { type: "draw" });
    const last = playWithChanges(match, "p3", { type: "draw" });
    expect(last.match.result).toEqual({ winners: ["p1", "p2"] });
    expect(last.changes).toEqual([
      { player: "p1", op: "stat", id: "siege", value: 1 },
      { player: "p2", op: "stat", id: "siege", value: 1 },
    ]);
  });

  it("resets the count as soon as someone can play again", () => {
    let match = matchFrom({
      hands: { p1: ["pik-K"], p2: ["herz-K", "kreuz-D"] },
      discard: ["herz-9"],
      deck: [],
    });
    match = play(match, "p1", { type: "draw" });
    expect(match.state.public.stuck).toBe(1);
    match = play(match, "p2", { type: "play", card: "herz-K" });
    expect(match.state.public.stuck).toBe(0);
    expect(match.result).toBeUndefined();
  });
});

describe("House rules", () => {
  it("allows playing a jack on a jack with the jack-on-jack rule", () => {
    const table: Table = { hands: { p1: ["pik-B", "herz-K"], p2: ["kreuz-B", "karo-9"] }, discard: ["herz-9"], deck: ["kreuz-A"] };
    const strict = play(matchFrom(table), "p1", { type: "play", card: "pik-B", wish: "herz" });
    expect(movesOf(strict, "p2")).toEqual([{ type: "draw" }]);
    const loose = play(matchFrom(table, { ...standardOptions, bubeAufBube: true }), "p1", { type: "play", card: "pik-B", wish: "herz" });
    expect(movesOf(loose, "p2")).toEqual([
      { type: "play", card: "kreuz-B", wish: "kreuz" },
      { type: "play", card: "kreuz-B", wish: "pik" },
      { type: "play", card: "kreuz-B", wish: "herz" },
      { type: "play", card: "kreuz-B", wish: "karo" },
    ]);
    const again = play(loose, "p2", { type: "play", card: "kreuz-B", wish: "karo" });
    expect(again.state.public).toMatchObject({ wish: "karo", current: "p1" });
  });

  it("only lets the next player draw without stacking 7s", () => {
    const table: Table = {
      hands: { p1: ["herz-7", "pik-K"], p2: ["pik-7", "herz-K"], p3: ["karo-9", "kreuz-7"] },
      discard: ["herz-9"],
      deck: ["kreuz-A", "kreuz-K", "kreuz-D", "kreuz-B", "karo-A"],
    };
    const options = { ...standardOptions, siebenerStapeln: false };
    let match = play(matchFrom(table, options), "p1", { type: "play", card: "herz-7" });
    expect(match.state.public).toMatchObject({ current: "p2", penalty: 2 });
    expect(movesOf(match, "p2")).toEqual([{ type: "draw" }]);
    match = play(match, "p2", { type: "draw" });
    expect(match.state.players["p2"]?.hand).toHaveLength(4);
    expect(match.state.public).toMatchObject({ current: "p3", penalty: 0 });
    expect(movesOf(match, "p3")).toEqual([{ type: "play", card: "kreuz-7" }]);
  });

  it("skips the next player after an ace instead of following up when the ace option is aussetzen", () => {
    const table: Table = { hands: { p1: ["herz-A", "pik-9"], p2: ["herz-D"], p3: ["herz-K", "pik-D"] }, discard: ["herz-9"], deck: ["kreuz-K"] };
    const standard = play(matchFrom(table), "p1", { type: "play", card: "herz-A" });
    expect(standard.state.public).toMatchObject({ current: "p1", phase: "play" });
    const skip = play(matchFrom(table, { ...standardOptions, ass: "aussetzen" }), "p1", { type: "play", card: "herz-A" });
    expect(skip.state.public).toMatchObject({ current: "p3", phase: "play" });
    expect(movesOf(skip, "p1")).toEqual([]);
    expect(movesOf(skip, "p2")).toEqual([]);
    expect(movesOf(skip, "p3")).toEqual([{ type: "play", card: "herz-K" }]);
  });

  it("plays whole matches to the end with every combination of house rules", () => {
    for (const bubeAufBube of [false, true]) {
      for (const siebenerStapeln of [false, true]) {
        for (const ass of ["nochmal", "aussetzen"] as const) {
          const options = { bubeAufBube, siebenerStapeln, ass };
          const created = createMatch(mauMau, { playerCount: 3, seed: `haus-${bubeAufBube}-${siebenerStapeln}-${ass}`, options, catalog });
          if (!created.ok) {
            throw new Error(created.error.message);
          }
          let match = created.match;
          for (let step = 0; step < 2000 && match.result === undefined; step++) {
            const player = match.players.find((seat) => (match.moves[seat] ?? []).length > 0) as string;
            const outcome = applyMove(mauMau, match, { player, action: (match.moves[player] ?? [])[0]!, now: 0 }, { catalog });
            if (!outcome.ok) {
              throw new Error(outcome.error.message);
            }
            match = outcome.match;
          }
          expect(match.result, JSON.stringify(options)).toBeDefined();
        }
      }
    }
  });
});
