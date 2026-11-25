# Mau-Mau for Gamehearth

Mau-Mau for 2–6 players, each on their own device: the first game for Gamehearth, a self-hostable game platform. The game logic runs as a reducer on the server, the UI is built with Phaser 4. It speaks German and English, comes with a pixel-art cover, offers bots for empty seats and has sounds.

The game gets onto a Gamehearth server through a catalog, for example the [Gamehearth catalog](https://github.com/hearthbit/gamehearth-catalog): add the catalog in the admin view and install Mau-Mau.

## Develop

You need Node 22.

```bash
npm install
npm test
npm run typecheck
npm run build
npm run check
```

| Command | What it does |
|---|---|
| `npm test` | rule, bot and sound tests and simulations with Vitest |
| `npm run build` | builds the client into `dist/client` |
| `npm run check` | checks the game with the Gamehearth dev tool: manifest, licenses, bot matches, leaks, determinism, run in the server sandbox; adds new profile IDs to `ids.lock` |
| `npm run pack` | builds the client and the game package `dist/mau-mau-<version>.zip`, only if `check` reports no errors |

The SDK ([`@gamehearth/sdk`](https://www.npmjs.com/package/@gamehearth/sdk)) and the dev tool ([`gamehearth`](https://www.npmjs.com/package/gamehearth)) come from npm; `npm update` brings newer versions within the ranges in `package.json`.

`ids.lock` records which profile IDs (here the stat `siege`) have ever existed, and belongs in the repo. A published ID stays in `manifest.json` forever, if need be with `"deprecated": true`; in CI, `check` fails if `ids.lock` does not match the manifest.

## Publish

1. Raise the version in `manifest.json` and `package.json`, commit.
2. Create and push the tag: `git tag v0.5.1 && git push origin v0.5.1`.
3. The CI builds the package with `check` and `pack` and attaches it to a release with this tag.
4. Add the version in the catalog repo: `npx gamehearth catalog add catalog.json https://github.com/hearthbit/gamehearth-mau-mau/releases/download/v0.5.1/mau-mau-0.5.1.zip`, commit and push.

After that, the admin view of every server with this catalog shows the update.

## Rules

**Cards:** 32 cards, suits clubs (Kreuz), spades (Pik), hearts (Herz) and diamonds (Karo), values 7, 8, 9, 10, jack (Bube), queen (Dame), king (König), ace (Ass).

**Dealing:** Everyone gets 5 cards. One card lies face up as the discard pile, the rest forms the face-down draw pile. The face-up starting card has no special effect. Player 1 starts, then it goes around in turn.

**Matching:** You play a card of the same suit or the same value onto the discard pile.

**Drawing:** Whoever cannot match draws a card. If it fits, you may play it right away; otherwise it is the next player's turn. If the draw pile is empty, the discard pile except its top card is reshuffled.

**Special cards:**

| Card | Effect |
|---|---|
| 7 | The next player draws 2 cards. Instead, they can play a 7 themselves; then the player after them draws 4, and so on. Whoever draws the penalty cards may not play anything else this turn. |
| 8 | The next player is skipped. With two players, you therefore get another turn right away. |
| Jack | May be played on any card except a jack. Whoever plays it wishes for a suit; the next player must play that suit or draw. |
| Ace | Whoever plays an ace gets another turn right away and must follow up with a matching card: same suit, another ace or a jack. If they cannot, they draw a card; if it fits, they may play it right away, otherwise it is the next player's turn. |

**End:** Whoever is the first to have no cards left wins, and the match ends immediately. This also applies if the last card is a special card. If, going around, nobody can play or draw because there is no draw pile left, the match ends as well; then whoever has the fewest cards wins.

**Wins:** Whoever wins gets a win in their profile (`siege`); in a tie, everyone with the fewest cards does. The platform's game page shows a leaderboard for it. Guests get it only for this round.

**Without:** calling "Mau" and "Mau-Mau".

**House rules:** The host sets them in the lobby. The table above describes the default.

| Option | Default | Effect |
|---|---|---|
| Jack on jack ("Bube auf Bube") | no | with "yes", a jack may also be played on a jack; the new wish applies |
| Stack 7s ("7er stapeln") | yes | with "no", nobody may play a 7 on an open 7; the next player draws the penalty cards |
| Ace ("Ass") | another turn ("noch mal dran") | with "next player is skipped" ("Nächster setzt aus"), an ace works like an 8: the next player is skipped, and whoever played it does not have to follow up |

The table names house rules that differ from the default where they currently apply, for example "+2 · no stacking" ("+2 · nicht stapeln").

## State

| Part | Content |
|---|---|
| `public` | discard pile, whose turn it is (`current`), phase (`play` or `drawn`), wished suit, open penalty cards from 7s, hand sizes, size of the draw pile |
| `players[seat]` | own hand, the card just drawn |
| `secret` | draw pile |

After drawing, the public phase is always `drawn`, whether or not the drawn card fits. This way the display does not reveal whether someone could play.

## Moves

| Move | when |
|---|---|
| `{ type: "play", card: "herz-7" }` | play a card |
| `{ type: "play", card: "pik-B", wish: "karo" }` | play a jack and wish for a suit |
| `{ type: "draw" }` | draw when nothing fits (also after an ace), or take the penalty cards of a 7 |
| `{ type: "pass" }` | do not play the card just drawn |

Cards are named `farbe-wert` (suit-value), for example `kreuz-10`, `herz-B` (jack), `pik-D` (queen), `karo-K` (king), `herz-A` (ace).

## UI

The client lives in `client/` and is built with Phaser 4, Vite and TypeScript, the recommended starter stack for Gamehearth games. `npm run build` builds it into `dist/client`; the manifest names this folder (`"client": "dist/client"`).

| File | Content |
|---|---|
| `client/src/main.ts` | connects to the platform via `@gamehearth/sdk/client` and starts Phaser |
| `client/src/table.ts` | the table as a Phaser scene: other players at the top, draw pile and discard pile in the middle, your own hand at the bottom, buttons for drawing and keeping, choice of the wished suit for a jack |
| `client/src/art.ts` | draws cards, card back, suit symbols and felt onto canvas textures at startup; no image files, everything CC0 |
| `client/src/view.ts` | everything the UI decides, without Phaser: card names, sorting, playable cards, status line, layout of the hand; tested in `test/view.test.ts` |
| `client/src/sounds.ts` | which sound an update plays, from the previous and the new snapshot; tested in `test/sounds.test.ts` |
| `client/src/access.ts` | an invisible list of the legal moves as buttons and a description of the table for screen readers and keyboard; the browser tests play through it |
| `client/src/texts.ts` | every text players see or hear, in German and English (`defineTexts` from the SDK) |
| `client/public/cover.svg` | the cover image; Vite copies it into `dist/client` |

Controls: playable cards sit a little higher, the others are dimmed while it is your turn. Tapping plays the card; for a jack, the game asks for the wished suit. Drawing works via the button or the draw pile. The UI shows only what is in your own snapshot; it does not know which cards others hold.

On high-resolution displays, the scene works in device pixels (Phaser with `zoom: 1 / devicePixelRatio`), so cards and text stay sharp.

## Bots

Mau-Mau offers bots. In the lobby the host adds bots to fill up the table (two people plus two bots, or alone against bots); during a match the host can hand the seat of someone whose device is gone to a bot, and everyone can let a bot play for them and take their seat back later. Bots count toward the player count, and wins against bots count on the leaderboard. A seat handed over to a bot keeps its person's profile, so a win there is theirs.

The bot (`src/bot.ts`) plays like a sensible family member, not like a card shark:

- It plays a card whenever it can and only draws when nothing fits; it plays a card it just drew if it fits, and stacks a 7 instead of taking the penalty cards.
- Among the cards that fit, it prefers the one that leaves it the most matching cards for later. It keeps jacks until nothing else fits and then wishes the suit it holds most.
- It likes 7s and 8s, especially when the next player is down to one or two cards. It follows the house rules: with "another turn" it only plays an ace when it can follow up, with "next player is skipped" an ace counts like an 8, and without stacking a 7 is an even better attack.
- It only looks at what its own seat sees: the table, the hand sizes and its own hand, never the draw pile or other hands. Ties are broken with the bot's own random generator, so the same situation gives the same choice.

`npm run check` plays extra matches in which the bot plays every seat.

## Sound

The game plays short sounds through the platform; it has no sound files. They stay off until the sound switch in the game menu is turned on (on an iPhone, the ringer must be on too). Every sound is personal and comes from your own phone; others playing or drawing make no sound on your phone, only what concerns you does.

| When | Sound |
|---|---|
| you play a card | `select`, for a 7, 8, jack or ace `coin` |
| you draw | a short swish per card, at most four |
| it becomes your turn | `blip` |
| a 7 lands on you | `hit` |
| an 8 (or an ace with "next player is skipped") jumps over you | two falling notes |
| the match ends | `win` if you are among the winners, otherwise `lose` |

Nothing is only heard: the table shows everything as well.

## Languages

German (the default) and English. The platform picks the language for each device, so everyone at the same table can play in their own language; the state holds only card IDs. The UI takes the language from `game.language` and gets all its texts from `client/src/texts.ts`: status line, buttons, badges, the wish dialog, the descriptions for screen readers and the card corners (B, D, K, A in German, J, Q, K, A in English). The manifest carries the description, the house rule labels and the label of the `siege` stat in both languages; the name "Mau-Mau" is the same everywhere. The rules produce no texts for players: their error messages are English texts for developers.

## Cover

`client/public/cover.svg` shows the draw pile, a seven of hearts and an ace of spades on green felt, in pixel art (64 × 48 pixels, 4:3), drawn for Gamehearth and released under CC0. The manifest names it with `"cover": "cover.svg"`, and the platform shows it as the screen of the game's arcade cabinet; `npm run check` checks that it is in the built client folder, its type, size and aspect ratio.

## License

Code under MIT, the self-drawn cards and the cover under CC0 (see `manifest.json` and [LICENSE](LICENSE)).
