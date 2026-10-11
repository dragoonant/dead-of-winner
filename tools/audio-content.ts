// Authoring content for the audio layer: every prompt and spoken line is original wording.
// tools/audio-build-manifest.ts merges these into tools/audio-manifest.json (existing items are never overwritten,
// so hand edits to a prompt in the manifest survive; delete the item or the mp3 to redo it).

export interface SfxDef { id: string; group: string; prompt: string; durationSeconds: number; promptInfluence: number; loop?: boolean }
export interface MusicDef { id: string; group: string; prompt: string; durationSeconds: number; loop?: boolean }
export interface NarratorDef { id: string; group: string; text: string }

const q = (group: string, id: string, prompt: string, durationSeconds: number, promptInfluence = 0.6, loop = false): SfxDef => ({
  id, group, prompt, durationSeconds, promptInfluence, ...(loop ? { loop: true } : {}),
})

export const SFX: SfxDef[] = [
  // ---------- ambience ----------
  q('ambience', 'amb-wind-loop', 'A steady cold winter wind blowing across open snow: a low continuous howl with soft gusts and a fine hiss of blown snow, even and seamless, no music, no voices, no birds', 10, 0.6, true),
  q('ambience', 'amb-generator-loop', 'A diesel generator humming far away across the snow: a muffled steady low engine drone with a faint rhythmic put-put, even and seamless, no music, no voices', 8, 0.6, true),
  q('ambience', 'amb-fire-loop', 'A cozy fire burning in a stove, close up: a constant dense bed of small soft crackles and hissing embers with a gentle warm flame roar, evenly continuous, no loud pops, no silence, seamless, no music, no voices', 8, 0.6, true),
  q('ambience', 'amb-moans-loop', 'A far-off chorus of undead moans carried on the winter wind: many distant low hollow groans overlapping, ghostly and faint, even and seamless, no music, no screams, no words', 10, 0.55, true),
  q('ambience', 'snow-creak', 'Boots stepping slowly on deep frozen snow: a dry squeaky creak and crunch of packed snow, two slow steps, no music, no voices', 1.2, 0.6),
  // ---------- dice ----------
  q('dice', 'dice-3', 'Three wooden dice shaken in a hand then thrown onto a hard wooden table: a quick rattle, then a clatter and tumble to a stop, no music, no voices', 1.3, 0.6),
  q('dice', 'dice-4', 'Four wooden dice shaken in a hand then thrown onto a hard wooden table: a quick rattle, then a clatter and tumble to a stop, no music, no voices', 1.4, 0.6),
  q('dice', 'dice-5', 'Five wooden dice shaken in a cupped hand then thrown onto a hard wooden table: a longer rattle, then a busy clatter and tumble to a stop, no music, no voices', 1.5, 0.6),
  q('dice', 'dice-exposure', 'One large heavy die rolling slowly on a wooden table: a deep wooden knocking tumble that slows and settles with a final low thud, ominous, no music, no voices', 1.5, 0.6),
  q('dice', 'dice-single', 'One small die dropped and skittering a short way across a wooden table before it stops, no music, no voices', 0.8, 0.6),
  q('dice', 'food-bump', 'A small wooden token tapped down onto a cardboard game board: one short soft knock and a faint cardboard tick, no music, no rattle', 0.5, 0.65),
  // ---------- cards ----------
  q('cards', 'card-draw', 'One playing card slid off the top of a deck and picked up: a soft paper swish and a light flick, no music, no voices', 0.6, 0.65),
  q('cards', 'card-flip', 'A single playing card flipped face up onto a felt table: a crisp short paper snap and a soft slap, no music, no voices', 0.5, 0.65),
  q('cards', 'card-shuffle', 'A deck of cards riffle-shuffled: a quick fluttering paper riffle and a tidy squaring tap at the end, no music, no voices', 1.4, 0.6),
  q('cards', 'card-waste', 'A card tossed onto a discard pile: a light paper flick and a soft slap on a stack of cards, no music, no voices', 0.6, 0.65),
  q('cards', 'card-slide-crisis', 'A single card slid face down across a wooden table and stopping under a pile: a long soft paper scrape and a tiny tap, no music, no voices', 0.9, 0.65),
  q('cards', 'card-equip', 'A leather strap buckled and a small metal clip snapping shut as gear is equipped: one crisp metallic click and a leather creak, no music, no voices', 0.7, 0.65),
  // ---------- search (one per location) ----------
  q('search', 'search-police', 'Someone rummaging through a metal police locker: a steel door rattling open, clinking keys and handcuffs, hands searching a metal box, no music, no voices', 1.4, 0.6),
  q('search', 'search-grocery', 'Hands rummaging among grocery shelves: rustling plastic packaging, clinking tin cans, a glass jar sliding, cardboard scraping, no music, no voices', 1.4, 0.6),
  q('search', 'search-school', 'Rummaging through a school classroom: a wooden desk drawer scraping open, pencils rolling, a metal locker door rattling, paper shuffling, no music, no voices', 1.4, 0.6),
  q('search', 'search-library', 'Pages of old books and loose papers shuffled and flipped through: dry paper rustling, a heavy book thudding onto a wooden shelf, quiet, no music, no voices', 1.4, 0.6),
  q('search', 'search-hospital', 'Rummaging through a hospital supply cabinet: a metal drawer sliding, plastic pill bottles rattling, rubber gloves snapping, glass vials clinking, no music, no voices', 1.4, 0.6),
  q('search', 'search-gas', 'A gas station fuel pump handle lifted and its nozzle clacking back: a squeaky metal lever, fuel sloshing in a jerrycan, a heavy rubber hose dragging, no music, no voices', 1.4, 0.6),
  // ---------- actions ----------
  q('actions', 'barricade', 'A hammer driving nails into wooden planks to barricade a door: three quick hard hammer blows on nails with wood creaking, no music, no voices', 1.4, 0.6),
  q('actions', 'barricade-break', 'A wooden barricade splintering as it is smashed from outside: loud cracking planks, nails shrieking, wood crashing down, no music, no voices', 1.4, 0.6),
  q('actions', 'attract', 'A glass bottle thrown and smashing on a distant street: a short whoosh, a clean glass shatter and tinkling shards, no music, no voices', 1.2, 0.6),
  q('actions', 'clean-waste', 'Heavy rubbish bags dragged across snowy ground: plastic bags rustling and scraping, then a dull thump as they are dropped, no music, no voices', 1.4, 0.6),
  // ---------- combat ----------
  q('combat', 'melee-thud', 'A baseball bat swung hard into something solid: a short whoosh then one dull heavy thud, no music, no voices, no screaming', 0.8, 0.6),
  q('combat', 'gunshot', 'A loud close single pistol gunshot outdoors: one very sharp, powerful, full-volume bang with a short echo rolling away over snow, no music, no voices, no reloading', 1.5, 0.6),
  q('combat', 'zombie-drop', 'A heavy body collapsing onto frozen ground: a dull heavy fall, a slump and a soft rattle of clothing, no music, no voices', 1.2, 0.6),
  q('combat', 'zombie-growl', 'A single low guttural undead groan and wet rasp, hollow and slow, no words, no music, no screaming', 1.5, 0.6),
  // ---------- survivor attack ----------
  q('survivor attack', 'attack-scuffle', 'Two people scuffling and shoving: quick cloth scrapes, boots shuffling on a floor, a hard grunt of effort and a thump against a wall, no words, no music', 1.2, 0.6),
  q('survivor attack', 'card-snatch', 'A card snatched sharply out of a hand: a sudden quick paper snap and a short startled breath, no words, no music', 0.6, 0.6),
  // ---------- exposure ----------
  q('exposure', 'wound-grunt', 'A man\'s short sharp grunt of pain as he is hit, a pained exhale through the teeth, no words, no music', 0.7, 0.6),
  q('exposure', 'frostbite-shiver', 'A person shivering violently from cold: teeth chattering rapidly, ragged shaky breaths, cloth trembling, no words, no music', 1.5, 0.6),
  q('exposure', 'bite-scream', 'A short terrified scream of a woman cut off sharply, then a choked gasp, no words, no music', 1.5, 0.6),
  q('exposure', 'heartbeat', 'A slow heavy human heartbeat: four deep muffled thumps, tense and ominous, no music, no voices', 2.5, 0.6),
  q('exposure', 'survivor-death', 'A short pained cry of a man collapsing and a heavy fall onto snow, no words, no music', 1.8, 0.6),
  // ---------- colony ----------
  q('colony', 'crisis-bell', 'A single cold iron bell tolling slowly: one deep strike with a long ringing decay across a frozen valley, no music, no voices', 2.5, 0.6),
  q('colony', 'morale-drop', 'A low cello note sinking downward in pitch with a cold wind gust, a sorrowful falling sweep, no drums, no voices', 2.2, 0.55),
  q('colony', 'starvation-growl', 'A hungry stomach growling loudly: a long low gurgling rumble in a quiet room, no words, no music', 1.8, 0.6),
  q('colony', 'zombies-gate', 'Zombies arriving at a gate: dull dragging footsteps in snow, many hands slapping and rattling a chain-link gate, low groaning, no music, no screams', 2.5, 0.6),
  q('colony', 'overrun-crash', 'A gate crashing open under a crowd of bodies: metal buckling and a loud crash, followed by a distant scream, no music', 2.5, 0.6),
  q('colony', 'round-tick', 'A heavy mechanical clock tick: one deep wooden clunk of a counter moving one notch, short and dry, no music, no voices', 0.6, 0.65),
  // ---------- social ----------
  q('social', 'vote-tick', 'One slow clock tick, a single ominous tock in a silent room, no music, no voices', 0.6, 0.65),
  q('social', 'thumbs-clack', 'Several wooden pegs clacking down onto a table all at once: a sharp short staccato clatter of wood on wood, no music, no voices', 0.8, 0.6),
  q('social', 'exile-door', 'A heavy wooden door slammed shut hard in a cold hall with an iron bolt sliding across: a loud slam and a metal bolt clunk, no music, no voices', 1.5, 0.6),
  q('social', 'request-knock', 'Three firm knocks with a knuckle on a wooden door, knock knock knock, quiet room, no music, no voices', 1.2, 0.65),
  // ---------- interface ----------
  q('interface', 'ui-click', 'A soft single click of a wooden game piece placed on a table, very subtle and short, no music, no voices', 0.5, 0.65),
  q('interface', 'objective-complete', 'A short warm hopeful bell chime in a cold room: two soft glass bell notes rising, gentle decay, no music, no voices', 2, 0.55),
  q('interface', 'footsteps-snow', 'Three quick footsteps crunching through snow, boots on frozen powder, no music, no voices', 1.2, 0.6),
]

export const MUSIC: MusicDef[] = [
  { id: 'music-title', group: 'title', durationSeconds: 75, loop: true,
    prompt: 'Cold intimate instrumental title theme for a winter survival drama: a slow sparse solo piano melody in a minor key over a soft bed of wind, low bowed cello and quiet sustained strings, wide empty reverb, melancholic but quietly hopeful, no vocals, no drums, no percussion, a gentle ending that can loop back to the start' },
  { id: 'music-tension', group: 'tension', durationSeconds: 60, loop: true,
    prompt: 'Tense suspense underscore for a crisis and a vote: low pulsing string ostinato slowly growing, dissonant sustained violins, a deep muted heartbeat-like pulse and soft muted drum hits, cold and dread-filled, steady and loopable, no vocals, no melody, no big climax' },
  { id: 'music-victory', group: 'stinger', durationSeconds: 10,
    prompt: 'A short hopeful stinger as dawn breaks over a frozen colony: warm piano and strings rising into a gentle major chord that rings out and fades, quiet relief, no vocals, no drums' },
  { id: 'music-defeat', group: 'stinger', durationSeconds: 10,
    prompt: 'A short somber stinger as a colony falls: low cello and piano sinking into a hollow minor chord that fades away into cold wind, bleak and final, no vocals, no drums' },
  { id: 'music-colony-a', group: 'colony', durationSeconds: 120, loop: true,
    prompt: 'Low-intensity ambient underscore for a besieged winter colony: sparse single piano notes with long silences, soft sustained string pads, distant wind, calm and watchful, steady and even in volume with no build and no climax, cold and intimate, no vocals, no drums, no percussion' },
  { id: 'music-colony-b', group: 'colony', durationSeconds: 120, loop: true,
    prompt: 'Low-intensity ambient underscore for a besieged winter colony: a warm low cello drone and muted slow piano arpeggios, soft strings, faint creaking wood and wind, a quiet firelit mood, steady and even in volume with no build and no climax, no vocals, no drums, no percussion' },
]

const NAR = 'narrator'
export const NARRATOR: NarratorDef[] = [
  { id: 'nar-round-a', group: NAR, text: 'Another day in the snow. The colony holds, for now.' },
  { id: 'nar-round-b', group: NAR, text: 'A new round begins. The cold has not moved on.' },
  { id: 'nar-round-last', group: NAR, text: 'The last round. Whatever happens now, happens now.' },
  { id: 'nar-crisis-a', group: NAR, text: 'The colony meets a crisis. Hand in what you can spare.' },
  { id: 'nar-crisis-b', group: NAR, text: 'Something has gone wrong again. Cards go in, face down.' },
  { id: 'nar-crisis-ok', group: NAR, text: 'The colony weathers it. Barely.' },
  { id: 'nar-crisis-fail', group: NAR, text: 'It was not enough. The colony pays for it.' },
  { id: 'nar-gate', group: NAR, text: 'The dead have reached the gate.' },
  { id: 'nar-starve', group: NAR, text: 'The stores run dry, and the colony goes hungry.' },
  { id: 'nar-morale-low', group: NAR, text: 'Morale is almost gone. People are watching each other.' },
  { id: 'nar-vote-called', group: NAR, text: 'A vote has been called. Someone here is not trusted.' },
  { id: 'nar-vote-count', group: NAR, text: 'Three. Two. One.' },
  { id: 'nar-exiled', group: NAR, text: 'Exiled. The door closes behind them, and the cold takes the rest.' },
  { id: 'nar-spared', group: NAR, text: 'Not enough votes. They stay, and they will remember.' },
  { id: 'nar-objective-complete', group: NAR, text: 'The colony\'s goal is met. Hold on to it.' },
  { id: 'nar-colony-falls', group: NAR, text: 'The colony falls. The winter takes everyone who stayed.' },
  { id: 'nar-end-win', group: NAR, text: 'You made it through the winter, and you were not alone.' },
  { id: 'nar-end-lose', group: NAR, text: 'Some people left the colony alive. You were not among them.' },
  { id: 'nar-obj-x-weeks-of-darkness', group: 'objective intro', text: 'Eight weeks of darkness. Outlast the winter, and be still standing when the last day ends.' },
  { id: 'nar-obj-kill-them', group: 'objective intro', text: 'Kill them. Thin out the dead until only a handful are left walking.' },
  { id: 'nar-obj-find-a-cure', group: 'objective intro', text: 'Find a cure. Gather medicine, enough for everyone who set out, and bring it home.' },
  { id: 'nar-obj-home-sweet-home', group: 'objective intro', text: 'Home sweet home. Board up the colony, and every other place, until nothing gets through.' },
  { id: 'nar-obj-raiding-party', group: 'objective intro', text: 'Raiding party. Strip two other places bare before the cold takes them.' },
  { id: 'nar-obj-leave-it-all-behind', group: 'objective intro', text: 'Leave it all behind. Arm everyone, stock the food, and be ready to run.' },
  { id: 'nar-obj-stockpile', group: 'objective intro', text: 'Stockpile. Fill the supply, bar the doors, and hoard enough to last.' },
  { id: 'nar-obj-winter-has-come', group: 'objective intro', text: 'Winter has come. Keep feeding the fire, or the cold will finish this.' },
  { id: 'nar-obj-too-many-mouths', group: 'objective intro', text: 'Too many mouths. Five rounds. Hold out for five rounds.' },
  { id: 'nar-obj-we-need-more-samples', group: 'objective intro', text: 'We need more samples. Every dead one may carry something worth taking.' },
]

/** One line, three voices: the owner picks the narrator on sounds.html. */
export const SAMPLE_LINE = 'Another night. The fire is low, the gate is thin, and someone in this room is lying.'

export interface VoiceProfile { name: string; voiceId: string; role: string; settings: { stability: number; similarity_boost: number; style: number; speed: number } }
export const VOICES: Record<string, VoiceProfile> = {
  narrator: { name: 'Jacob Eder', voiceId: '0c14Fsfhfnl8M9pCB5pf', role: 'Narrator (chosen): melancholic, bleak, defeated yet authoritative',
    settings: { stability: 0.62, similarity_boost: 0.8, style: 0.12, speed: 0.93 } },
  'alt-josh': { name: 'Josh', voiceId: 'GttLHvAanVsdyJN0LBjc', role: 'Narrator alternative: distant, cold and clear',
    settings: { stability: 0.62, similarity_boost: 0.8, style: 0.12, speed: 0.93 } },
  'alt-remmy': { name: 'Remmy', voiceId: 'Z7tQdvLS6QRQRjTLVY3x', role: 'Narrator alternative: dispirited, solemn and tired',
    settings: { stability: 0.62, similarity_boost: 0.8, style: 0.12, speed: 0.93 } },
  hardcase: { name: 'Katie', voiceId: 'xbiBdmKZawukYRB1IuEc', role: 'Hard Case: lower register, serious, husky',
    settings: { stability: 0.55, similarity_boost: 0.8, style: 0.2, speed: 1.0 } },
  optimist: { name: 'Will', voiceId: 'bIHbv24MWmeRgasZH58o', role: 'Optimist: relaxed, conversational tenor',
    settings: { stability: 0.42, similarity_boost: 0.78, style: 0.3, speed: 1.05 } },
  quartermaster: { name: 'Evelyn', voiceId: 'XEoBW4iDmiawQP72xnAF', role: 'Quartermaster: restrained, composed, even',
    settings: { stability: 0.66, similarity_boost: 0.8, style: 0.1, speed: 0.96 } },
}

/** How a persona line's {slots} are spoken (the bubble shows the real name; the voice cannot know it). */
export function spokenLine(template: string, key: string): string {
  if (template === 'Sorry, {seat}. The signs are too loud. Yes.') return 'Sorry. The signs are too loud. Yes.'
  const fill = (slot: string, atStart: boolean): string => {
    if (slot === 'n') return 'a few'
    if (slot === 'survivor') return atStart ? 'One of ours' : 'one of ours'
    if (key.startsWith('request.')) return 'friend'
    return atStart ? 'That one' : 'them'
  }
  return template.replace(/\{(\w+)\}/g, (_m, slot: string, offset: number) => {
    const before = template.slice(0, offset)
    return fill(slot, offset === 0 || /[.!?…]\s*$/.test(before))
  })
}

/** Crossroads cards voiced in the first pass (the 20 that existed when the audio layer was built). Newer cards stay text-only until
 *  someone runs `npx tsx tools/audio-build-manifest.ts --all-crossroads` and then gen-audio. */
export const CROSSROADS_VOICED: string[] = ["annaleigh-chan", "arthur-thurston", "bev-russell", "bitter-cold-night", "book-of-the-dead", "brian-lee", "carla-thompson", "christmas", "crazed-survivor", "david-garcia", "heads-up", "hunted", "jenny-clark", "little-survivors", "lovers-quarrel", "maude", "old-divisions", "outbreak", "outsiders", "rascals"]
