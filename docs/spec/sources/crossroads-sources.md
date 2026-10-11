# Crossroads cards: sources and encoding table

Updated 2026-10-11 (M8). All 80 base-game Crossroads cards are in `src/data/crossroads/`. Source for every trigger and option
effect: the BGG sheet `Crossroad_cards_v1.1.xlsx` (filepage 160324, transcribed in `docs/sources/bgg/Crossroad_cards_v1.1.xlsx.txt`,
gitignored, row 15 of `README.md`); cited per card as `BGG crossroads-v1.1 card N` (N = the sheet's card number). Rules checks used:
R p12 (Crossroads), FAQ 2.1.1 (trigger timing), F 2.2.1 / 2.3.1 / 2.4.1 (Bev Russel, Old Divisions, Outbreak), `docs/rulings-resolution.md`
(the first player breaks vote ties, even when exiled).

Rules for the data (IP rule, owner decision):

- Names may match the real cards. The trigger and both option effects are mechanically exact; where the DSL and the engine could not be
  exact the card's `notes` field says what was chosen.
- All prose is ours: a new 2 to 3 sentence vignette per card that leads to the same choice, option text written from the mechanics.
  `npm run check:copied` (and `tests/engine/xrd-copied.test.ts` where the sheet exists) confirms that no 8 consecutive words of any
  vignette, trigger or option text appear in the sheet.
- The sheet carries no mature mark. We flag cards about sex, suicide, drugs or the abuse of a child: Abandoned, Addiction, Brandon Kane,
  Voyeur, Welcome Home (nine flagged in all, with the four flagged earlier: Annaleigh Chan, Arthur Thurston, Bev Russell, Lover's Quarrel).
  Cards that need an exiled player (Mugging, Prophet) and Gray Beard are left out of the co-op variant.
- Survivor-named cards link to their survivor record through `survivor`.
- Cards in the sheet with a gap: Flier has no option text (flavour card, both options do nothing); Sleep prints a trigger no program can
  see (a player yawning; stand-in: 4 or more actions in a turn) and one option; Creature Comforts, Lighthouse and Janet Taylor print one
  option, so the second option is the decline.

| No. | Card | Window | Options | Hooks | Flags |
|---|---|---|---|---|---|
| 1 | `xr.car-crash` | `action.move` | wait-for-rescue, press-on | rule.fuelMove, rule.place |  |
| 2 | `xr.wavering-loyalties` | `action.any` | let-them-go, threaten-them | rule.outranks, rule.rollThen, wavering.give |  |
| 3 | `xr.horde` | `action.move` | push-through, turn-back | rule.fuelMove, rule.place |  |
| 4 | `xr.addiction` | `action.playCard` | swallow-the-rest, keep-the-habit | rule.attach, rule.playHealed, rule.spendDice | mature |
| 5 | `xr.spoiled` | `action.spendFood` | eat-it-anyway, throw-it-away | spoiled.spoil |  |
| 6 | `xr.maude` | `action.search` | haul-it-home, fill-your-pack |  |  |
| 7 | `xr.sparky` | `action.any` | pull-the-string, show-him-off | rule.survivor | survivor card |
| 8 | `xr.maria-lopez` | `action.any` | bring-them-food, open-the-pantry | rule.place, rule.searchDeck, rule.survivor | survivor card |
| 9 | `xr.brian-lee` | `action.ability` | hospital, grocery |  | survivor card |
| 10 | `xr.lovers-quarrel` | `action.move` | shout-it-out, cool-down |  | mature |
| 11 | `xr.mugging` | `action.any` | hand-it-over, fight-back | mugging.fight, mugging.hand, rule.mugging | no co-op |
| 12 | `xr.hunger` | `action.playCard` | let-him-eat, share-the-strange-meat | rule.hunger |  |
| 13 | `xr.thin-ice` | `action.move` | cross-the-ice, go-around | rule.rollThen, rule.searchDeck |  |
| 14 | `xr.helpless` | `action.any` | up, down | rule.purgeHelpless | vote |
| 15 | `xr.christmas` | `action.search` | hold-the-feast, keep-rationing |  |  |
| 16 | `xr.talia-jones` | `action.any` | find-the-cache, foresee-the-crisis | rule.attach, rule.searchDeck, rule.survivor, talia-jones.foresee | survivor card |
| 17 | `xr.arthur-thurston` | `action.search` | drive-them-off, open-fire |  | mature, survivor card |
| 18 | `xr.gray-beard` | `action.move` | hand-over-a-card, follow-his-rules | rule.attach, rule.recruit, rule.survivor | no co-op, survivor card |
| 19 | `xr.sophie-robinson` | `action.move` | pull-her-free, strip-the-wreck | rule.recruit, rule.removeFromDeck, rule.searchDeck, rule.survivor | survivor card |
| 20 | `xr.wounded-survivor` | `action.search` | take-them-in, wish-them-luck | rule.recruit |  |
| 21 | `xr.creature-comforts` | `action.any` | burn-the-fuel, save-the-fuel | rule.collectiveDiscard, rule.handsHave |  |
| 22 | `xr.outbreak` | `action.search` | up, down |  | vote |
| 23 | `xr.olivia-brown` | `action.any` | up, down | olivia-brown.shield, rule.attach, rule.place, rule.survivor | vote, survivor card |
| 24 | `xr.brandon-kane` | `action.any` | make-him-clean-up, bury-the-mess | rule.place, rule.recoverRemoved, rule.survivor | mature, survivor card |
| 25 | `xr.no-ammo` | `action.any` | bin-the-weapon, hunt-for-ammunition | rule.abilityUse, rule.spendDice, rule.wasteCard |  |
| 26 | `xr.forest-plum` | `action.any` | give-him-the-bottle, tell-him-no | rule.place, rule.survivor, rule.woundByInfluence | survivor card |
| 27 | `xr.daniel-smith` | `action.any` | open-an-investigation, look-away | rule.pick, rule.place, rule.spendDice, rule.survivor, rule.unequip | survivor card |
| 28 | `xr.little-survivors` | `action.move` | bring-them-home, leave-supplies |  |  |
| 29 | `xr.prophet` | `action.any` | win-them-over, leave-a-warning | prophet.convert, rule.prophet | no co-op |
| 30 | `xr.music` | `action.search` | play-for-the-evening, play-at-dawn |  |  |
| 31 | `xr.collapsing-barriers` | `action.any` | up, down | rule.eachSeatPick | vote |
| 32 | `xr.radio-signal` | `action.any` | up, down | radio-signal.answer | vote |
| 33 | `xr.toxic-waste` | `action.any` | up, down | rule.eachSeatPick, rule.recoverRemoved | vote |
| 34 | `xr.alexis-grey` | `action.any` | stay-and-read, walk-away | rule.lockMove, rule.place, rule.survivor | survivor card |
| 35 | `xr.james-meyers` | `action.any` | audit-the-medicine, read-a-secret | james-meyers.audit, james-meyers.readObjective, rule.survivor | survivor card |
| 36 | `xr.bev-russell` | `action.search` | stayWithThem, walkAway | bev-russel.clearSchool, bev-russel.immune, bev-russel.schoolWound | mature, survivor card |
| 37 | `xr.the-deputy` | `action.any` | take-the-deal, keep-your-guns | rule.attach, rule.seatAt |  |
| 38 | `xr.sewer-passage` | `action.any` | clear-the-tunnel, drop-the-idea | sewer-passage.dig |  |
| 39 | `xr.horse` | `action.move` | keep-the-horse, butcher-the-horse | rule.attach |  |
| 40 | `xr.thomas-heart` | `action.any` | lash-out, send-for-medics, end-it | rule.abilityUse, rule.survivor, thomas-heart.medics, thomas-heart.rage | decider, 3 options, survivor card |
| 41 | `xr.rod-miller` | `action.any` | carry-him-to-the-hospital, let-him-go | rod-miller.carry, rule.survivor | survivor card |
| 42 | `xr.supply-drop` | `action.any` | chase-the-parachute, let-it-drift | rule.ifAlive, rule.ifInPlay, rule.pick |  |
| 43 | `xr.army` | `action.any` | up, down, call-the-bluff | rule.attach, rule.rollEach, rule.survivor | vote, 3 options |
| 44 | `xr.gambling` | `action.any` | up, down | gambling.ante | vote |
| 45 | `xr.bitter-cold-night` | `action.move` | let-them-in, bar-the-door |  |  |
| 46 | `xr.lighthouse` | `action.any` | light-the-lamp, leave-it-dark | rule.spendDice |  |
| 47 | `xr.sacrament` | `action.move` | enter-the-cathedral, keep-walking | rule.ifAlive |  |
| 48 | `xr.outsiders` | `action.barricade` | take-them-in, send-them-on |  |  |
| 49 | `xr.riot` | `action.any` | empty-the-pantry, let-it-turn-ugly, make-an-example | riot.helplessOutnumber | 3 options |
| 50 | `xr.the-sunshine-state` | `action.any` | open-the-gates, tell-them-to-stay |  |  |
| 51 | `xr.flier` | `action.any` | read-it, tear-it-up |  |  |
| 52 | `xr.airplane` | `action.move` | up, down | airplane.fly, rule.survivor | vote |
| 53 | `xr.missing-child` | `action.any` | up, down | missing-child.watch | vote |
| 54 | `xr.abandoned` | `action.cleanWaste` | up, down | rule.spendDice | mature, vote |
| 55 | `xr.mike-cho` | `action.any` | fight-beside-him, slip-away | mike-cho.where, rule.recruit, rule.seatAt, rule.survivor | survivor card |
| 56 | `xr.john-price` | `action.search` | open-the-door, raid-the-cafeteria | rule.recruit, rule.removeFromDeck, rule.survivor | survivor card |
| 57 | `xr.ashley-ross` | `action.any` | raise-walkways, dig-a-waste-pit | rule.attach, rule.survivor | survivor card |
| 58 | `xr.edward-white` | `action.any` | culture-the-penicillin, leave-the-bread | rule.attach, rule.recoverRemoved, rule.removedHas, rule.survivor | survivor card |
| 59 | `xr.heads-up` | `action.search` | cooler, drum |  |  |
| 60 | `xr.sleep` | `action.any` | turn-in-early, stay-up | rule.attach, rule.spendDice, rule.yawn |  |
| 61 | `xr.buddy-davis` | `action.any` | run-the-workouts, take-the-joke | rule.attach, rule.survivor | survivor card |
| 62 | `xr.dynamite` | `action.any` | light-the-fuse, brew-a-batch | dynamite.blast, rule.survivor | decider |
| 63 | `xr.gabriel-diaz` | `action.any` | show-them-the-way, repay-them | rule.recruit, rule.removeFromHand, rule.seatAt, rule.survivor | survivor card |
| 64 | `xr.andrew-evans` | `action.any` | build-a-greenhouse, insulate-the-colony | rule.attach, rule.place, rule.survivor | survivor card |
| 65 | `xr.annaleigh-chan` | `action.ability` | openTheGates, giveUp |  | mature, survivor card |
| 66 | `xr.david-garcia` | `action.search` | accuse, take-it-back |  | vote, survivor card |
| 67 | `xr.crazed-survivor` | `action.search` | fight-her, run |  |  |
| 68 | `xr.welcome-home` | `action.move` | take-the-gun, run | rule.attach, rule.ifAlive | mature |
| 69 | `xr.book-of-the-dead` | `action.search` | keep-it, swing-it |  |  |
| 70 | `xr.rascals` | `action.search` | throw-party, skip-it |  |  |
| 71 | `xr.janet-taylor` | `action.any` | open-the-clinic, skip-the-clinic | rule.attach, rule.survivor | survivor card |
| 72 | `xr.old-divisions` | `action.move` | up, down | old-divisions.skipCrisis | vote |
| 73 | `xr.voyeur` | `action.any` | blackmail-them, tell-everyone | rule.pair, voyeur.expose, voyeur.peek, voyeur.take | mature |
| 74 | `xr.the-arctic-king` | `action.search` | take-the-snowmobile, siphon-the-tank | rule.attach, rule.searchDeck |  |
| 75 | `xr.carla-thompson` | `action.search` | face-it, back-away |  | survivor card |
| 76 | `xr.jenny-clark` | `action.search` | let-her-in, take-the-shot |  | survivor card |
| 77 | `xr.hunted` | `action.move` | hunt, lieLow |  |  |
| 78 | `xr.loretta-clay` | `action.any` | cook-it-anyway, throw-it-out | rule.rollEach, rule.rollThen, rule.survivor | survivor card |
| 79 | `xr.fuel-tanker` | `action.move` | drive-it-home, leave-it | rule.recoverRemoved |  |
| 80 | `xr.harman-brooks` | `action.any` | set-a-snare, gather-herbs | rule.survivor | survivor card |
