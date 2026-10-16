# Colony win rate: evidence for bot tuning

Researched 2026-10-11. All prose is ours. Every number carries a URL and a tag:
**measured** = logged play results, **derived** = our arithmetic on measured data, **anecdotal** = a reviewer's or poster's impression.

Bottom line: no poll or large logged dataset of colony win rate was found. BoardGameGeek (BGG) threads that would hold one
sit behind a bot wall and could not be read (see "Not retrieved"). The target band below is a judgement from weak evidence.

## Summary table

| Metric | Value | n / sample | Source | Tag |
|---|---|---|---|---|
| Per-seat win rate (a seat wins only if it meets its own secret objective AND the colony is not lost) | 14 wins in about 54 seat-results (about 26%) | 13 games, one group, avg 4.2 players | https://nemestats.com/GameDefinition/Details/58711 | measured (small), seat count derived |
| Per-seat win rate, second group | 16 wins in 46 seat-results (about 35%) | 11 games, one group, avg 4.2 players | https://nemestats.com/GameDefinition/Details/7720 | measured (small), seat count derived |
| Pooled per-seat win rate | about 30% | 24 games, 2 groups | the two NemeStats pages above | derived |
| Implied colony success rate | roughly 35-45% (assumes about 70-85% of non-betrayer seats hit their own goal once the colony succeeds; a betrayer win also counts as a seat win) | same 24 games | derived from the pooled figure | derived, very rough; the pages do not say whether coop results are logged per seat or as team results |
| "We win maybe half the time" | about 50% | one group, count unknown | https://www.mindgames.ca/dead-of-winter/ (search snippet only; the page returned 404 when fetched, so unverified) | anecdotal |
| "Your wins will be few and far between"; "brutal" | rare wins | one reviewer | https://gamecows.com/dead-of-winter-review/ and search snippets (not fetched) | anecdotal |
| "Undeniably tough; the colony can fail without any clear mistake" | hard | one reviewer | https://www.rpg.net/reviews/archive/17/17171.phtml (search snippet; fetch redirected, so unverified) | anecdotal |
| Library game guide rates difficulty "medium hard" | qualitative | one list | https://guides.fscj.edu/games/deadofwinter (snippet only) | anecdotal |
| Betrayer present | about 40% of games | designer deck rule, per a review | https://www.quartertothree.com/fp/2014/09/16/zombies-least-problems-dead-winter/ | stated as design fact in a review |
| How games are lost | abrupt morale collapse is the headline failure; losses by morale usually follow survivor deaths; rounds run out otherwise | qualitative | same Quarter to Three review | anecdotal |
| Rounds per game | set by the main objective, 5 to 10 on the objective cards (normal side 5 to 8; the hardcore side can raise it) | 10 objectives | https://boardgamegeek.com/thread/2054328/main-objective-cards (our local copy: docs/sources/bgg/thread-2054328-main-objectives.md) | measured from card data, not play logs |
| Play length | 60+ minutes | publisher listing | https://coopboardgames.com/cooperative-board-game-reviews/dead-winter-board-game-review/ | publisher data |
| Win rate by player count / by objective / normal vs hardcore | not found | none | n/a | no evidence |
| Designer statement on intended win rate | **30% target**; playtesters landed close to it; the co-designer's own experienced group "closer to 50" | co-designer reply, 2015-03 (over 100 playtest groups, each 10+ games, per the same post) | https://www.reddit.com/r/deadofwinter/comments/30h0on/my_beef_with_dead_of_winter/ (user JonnyRotten, who signs as Jon and calls himself co-designer; read via the arctic-shift Reddit archive API, 2026-10-15) | designer statement |

Designer material found is about tension, not odds. Gilmour said turning the tension up to eleven was always a goal, and
named public hard choices (Crossroads) as a main source of it: https://www.goodreads.com/author_blog_posts/6819861-dead-of-winter-a-crossroads-game-preview
(snippet). The one target found is the Reddit reply in the table: aimed at 30%, playtesters close, experienced tables
nearer 50%, because players learn tricks with plays. The post does not say whether "win" means the colony objective or a
seat win; we read it as the table (colony) result. Same thread: the designer suggests Pure Co-op, no betrayer, or an extra
starting card or food as house-rule easy modes, and says failing one crisis early on purpose is a sound tactic.

## How games end (rules, for modelling)

The game ends on morale 0, on the round track reaching 0, or on the main objective completing. Morale 0 and round 0 end
the game at once without checking the objective. Sources: our local copy of the rules wiki page
(docs/sources/fan/fandom/Winning_and_Losing_the_Game.txt) and the publisher rulebook at
https://media.plaidhatgames.com/old_images/games/dead-of-winter/rules.pdf. A seat wins only if its own secret objective is met
when the game ends, so the colony can succeed and individual seats still lose (Black Gate review noted this in play:
https://www.blackgate.com/?p=87339).

Consequence for tuning: report three numbers, not one. (a) Colony success (main objective done before morale or rounds
hit 0). (b) Per-seat win. (c) Share of losses by morale vs by rounds vs by exile-vote end.

## Commonly misplayed or easily forgotten rules (audit candidates)

Tag in brackets shows how well-sourced each one is. None of these has a measured frequency.

1. End-of-round zombie arrival is per survivor present at each location, and overrun survivors die. A 5-player group
   forgot it and lost 2-3 survivors that round. Forgetting it makes the game easier. [play log: https://unpluggedrva.com/blog/?p=103]
2. Crisis contributions: a card with the wrong symbol cancels a matching card, and the contributed pile is shuffled so
   nobody knows who helped. Ignoring the cancelling makes crises easier. [review snippet: https://hellnotes.com/dead-of-winter-board-game-review; check against the rulebook above]
3. Exposure on movement and when it can be avoided. A review flags this as the usual point of confusion. Skipping exposure
   rolls removes most of the bite and frostbite pressure on morale. [review snippet, same hellnotes URL; unverified detail]
4. Exile vote: one per game; a second vote ends the game. [review/blog snippet: https://unpluggedrva.com/blog/?p=103; confirm against rulebook]
5. Morale and round track ending the game with no objective check. Tables sometimes assume a last-minute completion still
   counts. [inference from the wiki and rulebook text above; not a reported mistake]
6. Waste and starvation costing morale every round (waste: one morale per ten cards; starvation tokens per missing food).
   Easy to under-apply, which would make games easier. [rulebook summary in snippet: https://gamerules.com/rules/dead-of-winter/; not a reported mistake]
7. Attracting zombies only into empty spots, frostbite counting as a wound, "kill" effects vs attacks, and similar edge
   cases are answered in the official rulings sheet, which suggests they are common questions. See
   docs/sources/bgg/official-rulings.txt. [inference]

Hardcore-side setup values (morale, rounds, extra zombies) are another likely source of "too easy" games when players use
the normal side by default. Values are in the main-objective thread linked above. [inference]

## Recommended target band

- Designer intent (2015 Reddit reply above): about **30%** for typical tables, about **50%** for experienced ones.
- Normal-side objectives, 3 to 5 competent seats: colony success **30% to 50%**. 30% matches design intent; 50% matches an
  expert table. (This replaced an earlier 40-60% guess made before the designer statement was found.)
- Per-seat win rate should then land around **25% to 40%**, matching the logged group data above (about 30%) once secret
  objectives and betrayers take their cut.
- Hardcore side (if we simulate it): **20% to 40%**. This is a design inference only; no source reports hardcore results.

Reasoning:
1. The only measured data (two groups, 24 games) puts per-seat wins near 30%, which implies colony success of roughly
   35-45% for ordinary tables that probably make a few rules mistakes.
2. Reviews split between "about half" and "wins are rare". That brackets 25-50% for human tables.
3. Common mistakes (items 1 to 3) all make the game easier, so true rules-correct play is probably a little harder than
   the reported rates. Bots that never forget rules, and that play objective-aware, can reasonably sit slightly above
   typical human colony success without being too easy.
4. The product goal is tension plus believable table-mates, not a solved game. A band of 30-50% keeps losses common
   enough to matter and wins reachable.
5. Do not tune the bots to a single scalar. Hold the colony-success band, then check that morale losses are the majority
   of losses and that the average game uses most of the round track (a game that routinely ends by round 3 of 6 is too
   punishing).

Evidence strength: **moderate** for the target (one designer statement), **weak** for measured rates. Re-check if the owner can read the BGG threads below by hand.

## Not retrieved (worth a manual look by the owner)

- "Win Loss Ratio" thread, a group poll split by betrayer vs no betrayer: https://boardgamegeek.com/thread/1326097/win-loss-ratio
- "Dead of Winter statistics!" thread: https://boardgamegeek.com/thread/1329386/dead-of-winter-statistics
Both returned a bot-check or 403 to every fetch method tried. Reddit (old.reddit.com) and web.archive.org were refused
by the fetch tool (Reddit threads can be read through the arctic-shift archive API, arctic-shift.photon-reddit.com). A real signed-in browser session could read them; do not try to bypass the bot check.
