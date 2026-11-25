import type { GameConnection } from "@gamehearth/sdk/client";
import type { MauMauAction, MauMauState, Options } from "../../src/index";
import type { Texts } from "./texts";
import { describeMove, describeTable, statusLine, type Snapshot } from "./view";

export function mountAccessibleControls(root: HTMLElement, connection: GameConnection<MauMauState, MauMauAction, Options>, t: Texts): void {
  const status = document.createElement("p");
  status.setAttribute("aria-live", "polite");
  const table = document.createElement("p");
  const moves = document.createElement("div");
  moves.setAttribute("role", "group");
  moves.setAttribute("aria-label", t.yourMoves);
  root.append(status, table, moves);
  let busy = false;
  connection.onUpdate((update) => {
    const snapshot = update.snapshot as Snapshot;
    status.textContent = statusLine(t, snapshot, update.players).text;
    table.textContent = describeTable(t, snapshot, update.players, update.options);
    moves.replaceChildren(
      ...snapshot.moves.map((move) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = describeMove(t, move, snapshot);
        button.addEventListener("click", () => {
          if (busy) {
            return;
          }
          busy = true;
          void connection.move(move).finally(() => {
            busy = false;
          });
        });
        return button;
      }),
    );
  });
}
