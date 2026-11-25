import { describe, expect, it } from "vitest";
import {
  cardName,
  cardParts,
  choices,
  depths,
  describeMove,
  describeTable,
  drawLabel,
  handSlots,
  houseRules,
  opponents,
  penaltyBadge,
  pileBadge,
  resultText,
  seatLabel,
  seatSlots,
  sortHand,
  statusLine,
  tilt,
  wishMove,
  type Players,
  type Snapshot,
} from "../client/src/view";
import { texts } from "../client/src/texts";
import { standardOptions, type MauMauAction, type Rank } from "../src/index";

const de = texts("de");
const en = texts("en");

const players: Players = {
  p1: { name: "Anna", connected: true, you: true },
  p2: { name: "Ben", connected: true, you: false },
  p3: { name: "Clara", connected: false, you: false },
};

function snapshot(overrides: Partial<Snapshot["public"]> = {}, moves: MauMauAction[] = [], extra: Partial<Snapshot> = {}): Snapshot {
  return {
    player: "p1",
    players: ["p1", "p2", "p3"],
    public: { discard: ["herz-9"], current: "p1", phase: "play", wish: null, penalty: 0, handSizes: { p1: 3, p2: 5, p3: 4 }, deckSize: 12, stuck: 0, ...overrides },
    me: { hand: ["karo-K", "herz-7", "kreuz-B"], drawn: null },
    moves,
    version: 4,
    ...extra,
  };
}

describe("Cards", () => {
  it("splits cards and names them readably", () => {
    expect(cardParts("herz-10")).toEqual({ suit: "herz", rank: "10", red: true });
    expect(cardParts("pik-B")).toEqual({ suit: "pik", rank: "B", red: false });
    expect(cardName(de, "karo-A")).toBe("Karo Ass");
    expect(cardName(de, "kreuz-D")).toBe("Kreuz Dame");
  });

  it("sorts the hand by suit and value", () => {
    expect(sortHand(["karo-7", "herz-A", "kreuz-10", "herz-8", "pik-B", "kreuz-7"])).toEqual(["kreuz-7", "kreuz-10", "pik-B", "herz-8", "herz-A", "karo-7"]);
  });

  it("always tilts each card on the pile the same way and only slightly", () => {
    expect(tilt("herz-7")).toBe(tilt("herz-7"));
    for (const card of ["herz-7", "pik-A", "karo-10", "kreuz-B"] as const) {
      expect(Math.abs(tilt(card))).toBeLessThanOrEqual(9.6);
    }
  });
});

describe("Moves", () => {
  const moves: MauMauAction[] = [
    { type: "play", card: "herz-7" },
    { type: "play", card: "kreuz-B", wish: "kreuz" },
    { type: "play", card: "kreuz-B", wish: "pik" },
    { type: "play", card: "kreuz-B", wish: "herz" },
    { type: "play", card: "kreuz-B", wish: "karo" },
    { type: "draw" },
  ];

  it("maps moves to cards and finds drawing and keeping", () => {
    const options = choices(moves);
    expect([...options.plays.keys()]).toEqual(["herz-7", "kreuz-B"]);
    expect(options.plays.get("kreuz-B")).toHaveLength(4);
    expect(options.draw).toEqual({ type: "draw" });
    expect(options.pass).toBeUndefined();
    expect(wishMove(options.plays.get("kreuz-B") ?? [], "herz")).toEqual({ type: "play", card: "kreuz-B", wish: "herz" });
  });

  it("describes moves for screen readers and tests", () => {
    const state = snapshot({ penalty: 4 });
    expect(describeMove(de, { type: "play", card: "herz-7" }, state)).toBe("Herz 7 legen");
    expect(describeMove(de, { type: "play", card: "kreuz-B", wish: "karo" }, state)).toBe("Kreuz Bube legen, Wunsch Karo");
    expect(describeMove(de, { type: "draw" }, state)).toBe("4 Karten ziehen");
    expect(describeMove(de, { type: "pass" }, state)).toBe("Behalten");
    expect(drawLabel(de, snapshot())).toBe("Ziehen");
  });
});

describe("Status line", () => {
  it("says whose turn it is", () => {
    expect(statusLine(de, snapshot({ current: "p2" }), players)).toEqual({ text: "Ben ist dran", mine: false });
    expect(statusLine(de, snapshot({}, [{ type: "play", card: "herz-7" }]), players)).toEqual({ text: "Du bist dran", mine: true });
    expect(statusLine(de, snapshot({}, [{ type: "draw" }]), players).text).toBe("Du bist dran: nichts passt, ziehen");
  });

  it("explains penalty cards and the drawn card", () => {
    expect(statusLine(de, snapshot({ penalty: 2 }, [{ type: "play", card: "herz-7" }, { type: "draw" }]), players).text).toBe("Eine 7 legen oder 2 Karten ziehen");
    expect(statusLine(de, snapshot({ penalty: 4 }, [{ type: "draw" }]), players).text).toBe("Du musst 4 Karten ziehen");
    expect(statusLine(de, snapshot({ phase: "drawn" }, [{ type: "play", card: "herz-7" }, { type: "pass" }]), players).text).toBe("Gezogene Karte legen oder behalten");
    expect(statusLine(de, snapshot({ phase: "drawn" }, [{ type: "pass" }]), players).text).toBe("Passt nicht, behalten");
  });

  it("names winners, ties and your own win", () => {
    expect(resultText(de, { winners: ["p1"] }, players, "p1")).toBe("Du hast gewonnen!");
    expect(resultText(de, { winners: ["p2"] }, players, "p1")).toBe("Ben hat gewonnen");
    expect(resultText(de, { winners: ["p1", "p2", "p3"] }, players, "p1")).toBe("Unentschieden: du, Ben und Clara");
    expect(resultText(de, { winners: [] }, players, "p1")).toBe("Niemand hat gewonnen");
    expect(statusLine(de, snapshot({}, [], { result: { winners: ["p3"] } }), players).text).toBe("Clara hat gewonnen");
  });

  it("describes the table without other players' hidden cards", () => {
    const text = describeTable(de, snapshot({ wish: "pik" }), players, standardOptions);
    expect(text).toBe("Oben liegt Herz 9. Gewünscht ist Pik. Deine Karten: Kreuz Bube, Herz 7, Karo König. Ben hat 5 Karten. Clara hat 4 Karten.");
  });

  it("names house rules that differ from the default", () => {
    expect(houseRules(de, standardOptions)).toBe("");
    expect(houseRules(de, { bubeAufBube: true, siebenerStapeln: false, ass: "aussetzen" })).toBe(
      "Hausregeln: Bube auf Bube, 7er nicht stapeln, nach einem Ass setzt der Nächste aus.",
    );
    expect(describeTable(de, snapshot(), players, { ...standardOptions, bubeAufBube: true })).toMatch(/^Hausregeln: Bube auf Bube\. Oben liegt/);
  });

  it("shows house rules where they currently apply", () => {
    const strict = { ...standardOptions, siebenerStapeln: false };
    expect(penaltyBadge(de, snapshot({ penalty: 2 }), standardOptions)).toBe("+2");
    expect(penaltyBadge(de, snapshot({ penalty: 2 }), strict)).toBe("+2 · nicht stapeln");
    expect(penaltyBadge(de, snapshot(), strict)).toBeUndefined();
    const buben = { ...standardOptions, bubeAufBube: true };
    expect(pileBadge(de, snapshot({ wish: "pik", discard: ["herz-9", "kreuz-B"] }), buben)).toEqual({ text: "Wunsch: Pik · Bube auf Bube", suit: "pik" });
    expect(pileBadge(de, snapshot({ wish: "pik", discard: ["herz-9", "kreuz-B"] }), standardOptions)).toEqual({ text: "Wunsch: Pik", suit: "pik" });
    const ass = { ...standardOptions, ass: "aussetzen" as const };
    expect(pileBadge(de, snapshot({ discard: ["herz-9", "herz-A"] }), ass)).toEqual({ text: "Nächster setzt aus", suit: undefined });
    expect(pileBadge(de, snapshot({ discard: ["herz-A"] }), ass)).toBeUndefined();
    expect(pileBadge(de, snapshot({ discard: ["herz-9", "herz-A"] }), standardOptions)).toBeUndefined();
  });
});

describe("Languages", () => {
  it("speaks English when the platform passes en", () => {
    expect(cardName(en, "karo-A")).toBe("Ace of Diamonds");
    expect(cardName(en, "herz-10")).toBe("10 of Hearts");
    const state = snapshot({ penalty: 4 });
    expect(describeMove(en, { type: "play", card: "herz-7" }, state)).toBe("Play 7 of Hearts");
    expect(describeMove(en, { type: "play", card: "kreuz-B", wish: "karo" }, state)).toBe("Play Jack of Clubs, wish for Diamonds");
    expect(describeMove(en, { type: "draw" }, state)).toBe("Draw 4 cards");
    expect(describeMove(en, { type: "pass" }, state)).toBe("Keep");
    expect(drawLabel(en, snapshot())).toBe("Draw");
    expect(statusLine(en, snapshot({ current: "p2" }), players).text).toBe("Ben's turn");
    expect(statusLine(en, snapshot({}, [{ type: "play", card: "herz-7" }]), players).text).toBe("Your turn");
    expect(statusLine(en, snapshot({}, [{ type: "draw" }]), players).text).toBe("Your turn: nothing fits, draw");
    expect(statusLine(en, snapshot({ penalty: 2 }, [{ type: "play", card: "herz-7" }, { type: "draw" }]), players).text).toBe("Play a 7 or draw 2 cards");
    expect(statusLine(en, snapshot({ penalty: 4 }, [{ type: "draw" }]), players).text).toBe("You have to draw 4 cards");
    expect(statusLine(en, snapshot({ phase: "drawn" }, [{ type: "play", card: "herz-7" }, { type: "pass" }]), players).text).toBe("Play the drawn card or keep it");
    expect(statusLine(en, snapshot({ phase: "drawn" }, [{ type: "pass" }]), players).text).toBe("Doesn't fit, keep it");
    expect(resultText(en, { winners: ["p1"] }, players, "p1")).toBe("You won!");
    expect(resultText(en, { winners: ["p2"] }, players, "p1")).toBe("Ben won");
    expect(resultText(en, { winners: ["p1", "p2", "p3"] }, players, "p1")).toBe("Tie: you, Ben and Clara");
    expect(resultText(en, { winners: [] }, players, "p1")).toBe("Nobody won");
  });

  it("describes the table and house rules in English", () => {
    expect(describeTable(en, snapshot({ wish: "pik" }), players, standardOptions)).toBe(
      "On top: 9 of Hearts. Wished suit: Spades. Your cards: Jack of Clubs, 7 of Hearts, King of Diamonds. Ben has 5 cards. Clara has 4 cards.",
    );
    expect(houseRules(en, { bubeAufBube: true, siebenerStapeln: false, ass: "aussetzen" })).toBe(
      "House rules: jack on jack, no stacking 7s, an ace skips the next player.",
    );
    const strict = { ...standardOptions, siebenerStapeln: false };
    expect(penaltyBadge(en, snapshot({ penalty: 2 }), strict)).toBe("+2 · no stacking");
    const buben = { ...standardOptions, bubeAufBube: true };
    expect(pileBadge(en, snapshot({ wish: "pik", discard: ["herz-9", "kreuz-B"] }), buben)).toEqual({ text: "Wish: Spades · jack on jack", suit: "pik" });
    const ass = { ...standardOptions, ass: "aussetzen" as const };
    expect(pileBadge(en, snapshot({ discard: ["herz-9", "herz-A"] }), ass)).toEqual({ text: "Next player is skipped", suit: undefined });
  });

  it("counts a single card in the singular", () => {
    const last = snapshot({ handSizes: { p1: 3, p2: 1, p3: 4 } });
    expect(describeTable(de, last, players, standardOptions)).toContain("Ben hat 1 Karte.");
    expect(describeTable(en, last, players, standardOptions)).toContain("Ben has 1 card.");
    expect(describeTable(en, snapshot({}, [], { me: { hand: [], drawn: null } }), players, standardOptions)).toContain("Your cards: none.");
  });

  it("marks offline players and the card corners per language", () => {
    expect(seatLabel(de, players, "p3")).toBe("Clara (offline)");
    expect(seatLabel(en, players, "p2")).toBe("Ben");
    expect(seatLabel(en, players, "p9")).toBe("p9");
    const corners: Rank[] = ["B", "D", "K", "A", "10"];
    expect(corners.map(de.cardIndex)).toEqual(["B", "D", "K", "A", "10"]);
    expect(corners.map(en.cardIndex)).toEqual(["J", "Q", "K", "A", "10"]);
    expect(en.whichSuit).toBe("Which suit do you wish for?");
    expect(de.yourMoves).toBe("Deine Züge");
  });

  it("falls back to German, the game's default, for other languages", () => {
    expect(texts("de-AT").yourTurn).toBe("Du bist dran");
    expect(texts("en-GB").yourTurn).toBe("Your turn");
    expect(texts("fr").yourTurn).toBe("Du bist dran");
  });
});

describe("Layout", () => {
  it("puts dialogs above every hand, even with all 32 cards", () => {
    expect(depths.overlay).toBeGreaterThan(depths.hand + 32);
    expect(depths.hand).toBeGreaterThan(depths.pile + 3);
  });


  it("places opponents in turn order after your own seat", () => {
    expect(opponents("p2", ["p1", "p2", "p3", "p4"])).toEqual(["p3", "p4", "p1"]);
    expect(opponents("p9", ["p1", "p2"])).toEqual(["p1", "p2"]);
    expect(seatSlots(3, 400, 10).map((slot) => slot.x)).toEqual([100, 200, 300]);
  });

  it("centers the hand and stays on screen, even with many cards", () => {
    const width = 390;
    const cardWidth = 80;
    for (const count of [1, 5, 12, 25]) {
      const slots = handSlots(count, width, 800, cardWidth, 116);
      expect(slots).toHaveLength(count);
      for (const slot of slots) {
        expect(slot.x - cardWidth / 2).toBeGreaterThanOrEqual(0);
        expect(slot.x + cardWidth / 2).toBeLessThanOrEqual(width);
      }
    }
    const one = handSlots(1, width, 800, cardWidth, 116)[0];
    expect(one?.x).toBe(width / 2);
    const many = handSlots(25, width, 800, cardWidth, 116);
    expect(new Set(many.map((slot) => slot.y)).size).toBeGreaterThan(1);
    expect(handSlots(0, width, 800, cardWidth, 116)).toEqual([]);
  });
});
