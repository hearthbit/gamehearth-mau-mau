import type { GameResult, PlayerId, PlayerInfo, PlayerSnapshot } from "@gamehearth/sdk/client";
import type { Card, Hand, MauMauAction, Options, Public, Rank, Suit } from "../../src/index";
import type { Texts } from "./texts";

export type Snapshot = PlayerSnapshot<Public, Hand, MauMauAction>;
export type Players = Record<PlayerId, PlayerInfo>;

export const depths = { pile: 10, hand: 200, overlay: 1000 } as const;

export const suitOrder: readonly Suit[] = ["kreuz", "pik", "herz", "karo"];
export const rankOrder: readonly Rank[] = ["7", "8", "9", "10", "B", "D", "K", "A"];

export interface CardParts {
  suit: Suit;
  rank: Rank;
  red: boolean;
}

export function cardParts(card: Card): CardParts {
  const at = card.indexOf("-");
  const suit = card.slice(0, at) as Suit;
  const rank = card.slice(at + 1) as Rank;
  return { suit, rank, red: suit === "herz" || suit === "karo" };
}

export function cardName(t: Texts, card: Card): string {
  const { suit, rank } = cardParts(card);
  return t.card(t.suit(suit), t.rank(rank));
}

export function sortHand(cards: readonly Card[]): Card[] {
  const key = (card: Card) => {
    const { suit, rank } = cardParts(card);
    return suitOrder.indexOf(suit) * 10 + rankOrder.indexOf(rank);
  };
  return [...cards].sort((a, b) => key(a) - key(b));
}

export interface Choices {
  plays: Map<Card, MauMauAction[]>;
  draw: MauMauAction | undefined;
  pass: MauMauAction | undefined;
}

export function choices(moves: readonly MauMauAction[]): Choices {
  const plays = new Map<Card, MauMauAction[]>();
  let draw: MauMauAction | undefined;
  let pass: MauMauAction | undefined;
  for (const move of moves) {
    if (move.type === "play") {
      plays.set(move.card, [...(plays.get(move.card) ?? []), move]);
    } else if (move.type === "draw") {
      draw = move;
    } else {
      pass = move;
    }
  }
  return { plays, draw, pass };
}

export function wishMove(options: readonly MauMauAction[], wish: Suit): MauMauAction | undefined {
  return options.find((move) => move.type === "play" && move.wish === wish);
}

export function opponents(seat: PlayerId, seats: readonly PlayerId[]): PlayerId[] {
  const at = seats.indexOf(seat);
  return at < 0 ? [...seats] : [...seats.slice(at + 1), ...seats.slice(0, at)];
}

export function nameOf(players: Players, seat: PlayerId): string {
  return players[seat]?.name ?? seat;
}

export function seatLabel(t: Texts, players: Players, seat: PlayerId): string {
  const info = players[seat];
  if (info === undefined) {
    return seat;
  }
  return info.connected ? info.name : t.offline(info.name);
}

export function drawLabel(t: Texts, snapshot: Snapshot): string {
  const penalty = snapshot.public.penalty;
  return penalty > 0 ? t.drawCards(t.cards(penalty)) : t.draw;
}

export function statusLine(t: Texts, snapshot: Snapshot, players: Players): { text: string; mine: boolean } {
  if (snapshot.result !== undefined) {
    return { text: resultText(t, snapshot.result, players, snapshot.player), mine: false };
  }
  const current = snapshot.public.current;
  if (current !== snapshot.player) {
    return { text: t.whoseTurn(nameOf(players, current)), mine: false };
  }
  const options = choices(snapshot.moves);
  if (snapshot.public.phase === "drawn") {
    return { text: options.plays.size > 0 ? t.playOrKeepDrawn : t.drawnDoesNotFit, mine: true };
  }
  if (snapshot.public.penalty > 0) {
    const cards = t.cards(snapshot.public.penalty);
    return { text: options.plays.size > 0 ? t.sevenOrDraw(cards) : t.mustDraw(cards), mine: true };
  }
  return { text: options.plays.size > 0 ? t.yourTurn : t.yourTurnDraw, mine: true };
}

export function resultText(t: Texts, result: GameResult, players: Players, seat: PlayerId): string {
  const winners = result.winners;
  if (winners.length === 0) {
    return t.nobodyWon;
  }
  if (winners.length === 1) {
    return winners[0] === seat ? t.youWon : t.won(nameOf(players, winners[0] as PlayerId));
  }
  const names = winners.map((winner) => (winner === seat ? t.youAsObject : nameOf(players, winner)));
  return t.tie(`${names.slice(0, -1).join(", ")} ${t.and} ${names[names.length - 1] ?? ""}`);
}

export interface Slot {
  x: number;
  y: number;
}

export function handSlots(count: number, width: number, bottom: number, cardWidth: number, cardHeight: number): Slot[] {
  if (count === 0) {
    return [];
  }
  const margin = cardWidth * 0.25;
  const available = Math.max(width - 2 * margin, cardWidth);
  const minStep = cardWidth * 0.36;
  const perRow = Math.max(1, Math.min(count, Math.floor((available - cardWidth) / minStep) + 1));
  const rows = Math.ceil(count / perRow);
  const slots: Slot[] = [];
  for (let row = 0; row < rows; row++) {
    const inRow = Math.min(perRow, count - row * perRow);
    const step = inRow > 1 ? Math.min(cardWidth * 0.72, (available - cardWidth) / (inRow - 1)) : 0;
    const total = cardWidth + step * (inRow - 1);
    const startX = (width - total) / 2 + cardWidth / 2;
    const y = bottom - cardHeight / 2 - (rows - 1 - row) * cardHeight * 0.42;
    for (let index = 0; index < inRow; index++) {
      slots.push({ x: startX + index * step, y });
    }
  }
  return slots;
}

export function seatSlots(count: number, width: number, top: number): Slot[] {
  return Array.from({ length: count }, (_, index) => ({ x: (width * (index + 1)) / (count + 1), y: top }));
}

export function tilt(card: Card): number {
  let hash = 0;
  for (let index = 0; index < card.length; index++) {
    hash = (hash * 31 + card.charCodeAt(index)) | 0;
  }
  return ((Math.abs(hash) % 17) - 8) * 1.2;
}

export function describeMove(t: Texts, move: MauMauAction, snapshot: Snapshot): string {
  if (move.type === "draw") {
    return drawLabel(t, snapshot);
  }
  if (move.type === "pass") {
    return t.keep;
  }
  return move.wish === undefined ? t.play(cardName(t, move.card)) : t.playWithWish(cardName(t, move.card), t.suit(move.wish));
}

export function houseRules(t: Texts, options: Options): string {
  const rules = [
    options.bubeAufBube ? t.jackOnJack : "",
    options.siebenerStapeln ? "" : t.noStacking,
    options.ass === "aussetzen" ? t.aceSkips : "",
  ].filter((rule) => rule !== "");
  return rules.length === 0 ? "" : t.houseRules(rules.join(", "));
}

export function penaltyBadge(t: Texts, snapshot: Snapshot, options: Options): string | undefined {
  if (snapshot.public.penalty <= 0) {
    return undefined;
  }
  return options.siebenerStapeln ? `+${snapshot.public.penalty}` : `+${snapshot.public.penalty} · ${t.noStackingBadge}`;
}

export function pileBadge(t: Texts, snapshot: Snapshot, options: Options): { text: string; suit: Suit | undefined } | undefined {
  const discard = snapshot.public.discard;
  const top = discard[discard.length - 1];
  const rank = top === undefined ? undefined : cardParts(top).rank;
  if (snapshot.public.wish !== null) {
    const text = t.wish(t.suit(snapshot.public.wish));
    return { text: options.bubeAufBube && rank === "B" ? `${text} · ${t.jackOnJack}` : text, suit: snapshot.public.wish };
  }
  if (options.ass === "aussetzen" && rank === "A" && discard.length > 1) {
    return { text: t.nextSkipped, suit: undefined };
  }
  return undefined;
}

export function describeTable(t: Texts, snapshot: Snapshot, players: Players, options: Options): string {
  const top = snapshot.public.discard[snapshot.public.discard.length - 1];
  const hand = sortHand(snapshot.me.hand).map((card) => cardName(t, card));
  const parts = [
    houseRules(t, options),
    top === undefined ? "" : t.onTop(cardName(t, top)),
    snapshot.public.wish === null ? "" : t.wished(t.suit(snapshot.public.wish)),
    t.yourCards(hand.join(", ") || t.none),
    ...opponents(snapshot.player, snapshot.players).map((seat) => t.holds(nameOf(players, seat), t.cards(snapshot.public.handSizes[seat] ?? 0))),
  ];
  return parts.filter((part) => part !== "").join(" ");
}
