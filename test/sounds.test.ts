import { soundProblem } from "@gamehearth/sdk/platform";
import { describe, expect, it } from "vitest";
import { drawSound, skippedSound, soundFor } from "../client/src/sounds";
import type { Snapshot } from "../client/src/view";
import { standardOptions, type Card } from "../src/index";

const skipAce = { ...standardOptions, ass: "aussetzen" as const };

function snapshot(publicPart: Partial<Snapshot["public"]> = {}, hand: Card[] = ["karo-K", "herz-7", "kreuz-B"], extra: Partial<Snapshot> = {}): Snapshot {
  return {
    player: "p2",
    players: ["p1", "p2", "p3"],
    public: { discard: ["herz-9"], current: "p1", phase: "play", wish: null, penalty: 0, handSizes: { p1: 4, p2: hand.length, p3: 4 }, deckSize: 12, stuck: 0, ...publicPart },
    me: { hand, drawn: null },
    moves: [],
    version: 4,
    ...extra,
  };
}

describe("Sounds", () => {
  it("plays nothing on the first update and nothing after the end", () => {
    const ended = snapshot({}, undefined, { result: { winners: ["p1"] } });
    expect(soundFor(undefined, snapshot(), standardOptions)).toBeUndefined();
    expect(soundFor(snapshot(), snapshot(), standardOptions)).toBeUndefined();
    expect(soundFor(ended, ended, standardOptions)).toBeUndefined();
  });

  it("plays win or lose when the match ends", () => {
    const before = snapshot({ current: "p2" });
    expect(soundFor(before, snapshot({ discard: ["herz-9", "karo-K"] }, [], { result: { winners: ["p2"] } }), standardOptions)).toBe("win");
    expect(soundFor(before, snapshot({}, undefined, { result: { winners: ["p1"] } }), standardOptions)).toBe("lose");
    expect(soundFor(before, snapshot({}, undefined, { result: { winners: ["p1", "p2"] } }), standardOptions)).toBe("win");
  });

  it("plays select for your own card and coin for your own special card", () => {
    const before = snapshot({ current: "p2" }, ["karo-9", "herz-7", "kreuz-B", "herz-A"]);
    expect(soundFor(before, snapshot({ discard: ["herz-9", "karo-9"], current: "p3" }, ["herz-7", "kreuz-B", "herz-A"]), standardOptions)).toBe("select");
    expect(soundFor(before, snapshot({ discard: ["herz-9", "herz-7"], current: "p3", penalty: 2 }, ["karo-9", "kreuz-B", "herz-A"]), standardOptions)).toBe("coin");
    expect(soundFor(before, snapshot({ discard: ["herz-9", "kreuz-B"], current: "p3", wish: "herz" }, ["karo-9", "herz-7", "herz-A"]), standardOptions)).toBe("coin");
    expect(soundFor(before, snapshot({ discard: ["herz-9", "herz-A"], current: "p2" }, ["karo-9", "herz-7", "kreuz-B"]), standardOptions)).toBe("coin");
  });

  it("plays hit when a 7 lands on you", () => {
    const before = snapshot({ current: "p1", discard: ["pik-9"] });
    expect(soundFor(before, snapshot({ discard: ["pik-9", "pik-7"], current: "p2", penalty: 2 }), standardOptions)).toBe("hit");
    expect(soundFor(snapshot({ current: "p1", discard: ["herz-7"], penalty: 2 }), snapshot({ discard: ["herz-7", "pik-7"], current: "p2", penalty: 4 }), standardOptions)).toBe("hit");
  });

  it("plays the skipped sound when an 8 or a skipping ace jumps over you", () => {
    const before = snapshot({ current: "p1" });
    expect(soundFor(before, snapshot({ discard: ["herz-9", "herz-8"], current: "p3" }), standardOptions)).toEqual(skippedSound);
    expect(soundFor(before, snapshot({ discard: ["herz-9", "herz-A"], current: "p3" }), skipAce)).toEqual(skippedSound);
    expect(soundFor(before, snapshot({ discard: ["herz-9", "herz-A"], current: "p1" }), standardOptions)).toBeUndefined();
    const fromP3 = snapshot({ current: "p3" });
    expect(soundFor(fromP3, snapshot({ discard: ["herz-9", "herz-8"], current: "p2" }), standardOptions)).toBe("blip");
  });

  it("knows that with two players an 8 skips you even though the turn stays with the other", () => {
    const two = { players: ["p1", "p2"] };
    expect(soundFor(snapshot({ current: "p1" }, undefined, two), snapshot({ discard: ["herz-9", "herz-8"], current: "p1" }, undefined, two), standardOptions)).toEqual(skippedSound);
    expect(soundFor(snapshot({ current: "p1" }, undefined, two), snapshot({ discard: ["herz-9", "herz-A"], current: "p1" }, undefined, two), standardOptions)).toBeUndefined();
    expect(soundFor(snapshot({ current: "p1" }, undefined, two), snapshot({ discard: ["herz-9", "herz-A"], current: "p1" }, undefined, two), skipAce)).toEqual(skippedSound);
  });

  it("plays blip when it becomes your turn", () => {
    expect(soundFor(snapshot({ current: "p1" }), snapshot({ discard: ["herz-9", "herz-K"], current: "p2" }), standardOptions)).toBe("blip");
    expect(soundFor(snapshot({ current: "p1", phase: "drawn" }), snapshot({ current: "p2" }), standardOptions)).toBe("blip");
    expect(soundFor(snapshot({ current: "p1" }), snapshot({ discard: ["herz-9", "pik-B"], current: "p2", wish: "pik" }), standardOptions)).toBe("blip");
  });

  it("stays quiet when others play or draw and it is not your turn", () => {
    expect(soundFor(snapshot({ current: "p3" }), snapshot({ discard: ["herz-9", "herz-K"], current: "p1" }), standardOptions)).toBeUndefined();
    expect(soundFor(snapshot({ current: "p3" }), snapshot({ current: "p3", phase: "drawn", handSizes: { p1: 4, p2: 3, p3: 5 } }), standardOptions)).toBeUndefined();
  });

  it("plays one swish per card you draw, at most four", () => {
    const before = snapshot({ current: "p2" }, ["karo-K"]);
    expect(soundFor(before, snapshot({ current: "p2", phase: "drawn" }, ["karo-K", "pik-9"]), standardOptions)).toEqual(drawSound(1));
    expect(soundFor(snapshot({ current: "p2", discard: ["herz-7"], penalty: 2 }, ["karo-K"]), snapshot({ current: "p3", discard: ["herz-7"] }, ["karo-K", "pik-9", "pik-D"]), standardOptions)).toEqual(drawSound(2));
    expect(drawSound(2)).toMatchObject({ notes: [{ at: 0 }, { at: 0.09 }] });
    expect(drawSound(8)).toMatchObject({ notes: { length: 4 } });
    expect(drawSound(0)).toMatchObject({ notes: { length: 1 } });
  });

  it("only uses sounds the platform accepts", () => {
    for (const sound of [skippedSound, drawSound(1), drawSound(4), drawSound(12)]) {
      expect(soundProblem(sound)).toBeUndefined();
    }
  });
});
