import type { PlayerId, Random } from "@gamehearth/sdk";
import { rankOf, suitOf, suits, type Card, type Suit } from "./cards";
import type { MauMauAction, MauMauState, Options } from "./game";

type Play = Extract<MauMauAction, { type: "play" }>;

export function chooseMove(
  state: MauMauState,
  player: PlayerId,
  moves: readonly MauMauAction[],
  players: readonly PlayerId[],
  random: Random,
  options: Options,
): MauMauAction | undefined {
  const plays = moves.filter((move): move is Play => move.type === "play");
  if (plays.length === 0) {
    return moves.find((move) => move.type === "draw") ?? moves[0];
  }
  const hand = state.players[player]?.hand ?? [];
  const nextHandSize = state.public.handSizes[nextSeat(players, player)] ?? Infinity;
  const cards = [...new Set(plays.map((move) => move.card))];
  const scored = cards.map((card) => ({ card, score: playScore(card, without(hand, card), nextHandSize, options) }));
  const best = Math.max(...scored.map((entry) => entry.score));
  const card = random.pick(scored.filter((entry) => entry.score === best)).card;
  const forCard = plays.filter((move) => move.card === card);
  if (forCard.length === 1) {
    return forCard[0];
  }
  const wish = wishFor(without(hand, card), random);
  return forCard.find((move) => move.wish === wish) ?? random.pick(forCard);
}

export function playScore(card: Card, rest: readonly Card[], nextHandSize: number, options: Options): number {
  if (rest.length === 0) {
    return 100;
  }
  const rank = rankOf(card);
  if (rank === "B") {
    return -10;
  }
  const followers = rest.filter((held) => rankOf(held) !== "B" && (suitOf(held) === suitOf(card) || rankOf(held) === rank)).length;
  const pressure = nextHandSize <= 2 ? 3 : 1;
  switch (rank) {
    case "7":
      return followers + (options.siebenerStapeln ? pressure : pressure + 1);
    case "8":
      return followers + pressure;
    case "A":
      if (options.ass === "aussetzen") {
        return followers + pressure;
      }
      return followers > 0 || rest.some((held) => rankOf(held) === "B") ? followers + 2 : followers - 1;
    default:
      return followers;
  }
}

export function wishFor(rest: readonly Card[], random: Random): Suit {
  const counts = suits.map((suit) => ({ suit, count: rest.filter((card) => rankOf(card) !== "B" && suitOf(card) === suit).length }));
  const most = Math.max(...counts.map((entry) => entry.count));
  return random.pick(counts.filter((entry) => entry.count === most)).suit;
}

function without(hand: readonly Card[], card: Card): Card[] {
  return hand.filter((held) => held !== card);
}

function nextSeat(players: readonly PlayerId[], player: PlayerId): PlayerId {
  const at = players.indexOf(player);
  return players[(at + 1) % players.length] ?? player;
}
