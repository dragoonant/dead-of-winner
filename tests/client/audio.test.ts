import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { GameEvent } from '../../src/engine/index'
import { ambienceLevels, crossroadsLine, diceSound, newSoundMemo, objectiveIntroLine, planEvent } from '../../src/client/audio/eventSounds'
import { AUDIO_ASSETS, AUDIO_BY_ID } from '../../src/client/audio/manifest'
import { personaLineId } from '../../src/client/audio/personaVoice'
import { prepareBeatAudio } from '../../src/client/audio/presentAudio'
import { DEFAULT_AUDIO_SETTINGS, sanitizeAudioSettings } from '../../src/client/audio/settings'
import { DURATIONS, TRIMS } from '../../src/client/audio/trims'
import { PERSONAS } from '../../src/ai/personas'

const root = join(import.meta.dirname, '..', '..')
const ctx = { viewer: 's1', state: null }

describe('audio manifest', () => {
  it('has a file, a trim and a duration for every asset', () => {
    for (const a of AUDIO_ASSETS) {
      const path = join(root, 'public', 'audio', a.kind === 'music' ? 'music' : '', `${a.id}.mp3`)
      expect(existsSync(path), a.id).toBe(true)
      expect(TRIMS[a.id], `trim ${a.id}`).toBeGreaterThan(0)
      expect(DURATIONS[a.id], `duration ${a.id}`).toBeGreaterThan(0)
    }
  })

  it('only names ids that exist in eventSounds.ts', () => {
    const src = readFileSync(join(root, 'src', 'client', 'audio', 'eventSounds.ts'), 'utf8')
    const ids = [...src.matchAll(/'((?:nar|amb|dice|card|search|footsteps|vote|thumbs|exile|request|zombie|zombies|round|wound|frostbite|bite|heartbeat|survivor|crisis|morale|starvation|overrun|barricade|attract|clean|melee|gunshot|food|objective|vo)-[a-z0-9-]*)'/g)].map((m) => m[1]!)
    expect(ids.length).toBeGreaterThan(40)
    for (const id of ids) if (!/^(nar-obj-|vo-xr-)$/.test(id) && !id.endsWith('-')) expect(AUDIO_BY_ID[id], id).toBeDefined()
  })

  it('voices every line flagged voiced in every persona bank (the rest are text-only until someone prices them)', () => {
    expect(PERSONAS.length).toBeGreaterThanOrEqual(3)
    for (const p of PERSONAS) {
      for (const [key, bank] of Object.entries(p.lines)) {
        for (const l of bank) {
          if (!l.voiced) continue
          const filled = l.text.replace(/\{seat\}/g, 'Wren').replace(/\{survivor\}/g, 'Sparky').replace(/\{n\}/g, '3')
          expect(personaLineId(p.id, key, filled), `${p.id} ${key} ${l.text}`).not.toBeNull()
        }
      }
    }
    expect(personaLineId('ps.hardcase', 'vote.called', 'something nobody wrote')).toBeNull()
  })
})

describe('event sounds', () => {
  const memo = () => newSoundMemo()
  it('maps dice by count and exposure faces to their cries', () => {
    expect([1, 3, 4, 5, 6].map(diceSound)).toEqual(['dice-single', 'dice-3', 'dice-4', 'dice-5', 'dice-5'])
    const bite = planEvent({ type: 'ExposureRolled', rollId: 'r', survivorId: 'sv', reason: 'move', raw: 6, face: 'bite' } as GameEvent, ctx, memo())
    expect(bite.sounds.map((s) => s.id)).toEqual(['dice-exposure', 'bite-scream'])
  })

  it('narrates round, crisis, vote, exile and the end, holding the beat', () => {
    const m = memo()
    const hold = (ev: object) => planEvent(ev as GameEvent, ctx, m).narration.filter((n) => n.hold).map((n) => n.id)
    expect(hold({ type: 'RoundStarted', roundNumber: 2, roundsLeft: 4 })).toHaveLength(1)
    expect(hold({ type: 'CrisisRevealed', cardId: 'cr.x', prevent: [], roundNumber: 2 })).toHaveLength(1)
    expect(hold({ type: 'VoteCalled', caller: 's1', target: 's2' })).toEqual(['nar-vote-called'])
    expect(hold({ type: 'SeatExiled', seat: 's2', objectiveId: 'x' })).toEqual(['nar-exiled'])
    expect(hold({ type: 'GameEnded', reason: 'moraleZero', objectiveComplete: false, winners: [], morale: 0, roundsLeft: 2 })).toEqual(['nar-colony-falls', 'nar-end-lose'])
    expect(planEvent({ type: 'CrisisRevealed', cardId: 'cr.x', prevent: [], roundNumber: 2 } as GameEvent, ctx, m).music).toBe('tension')
    expect(planEvent({ type: 'GameEnded', reason: 'objectiveComplete', objectiveComplete: true, winners: ['s1'], morale: 3, roundsLeft: 1 } as GameEvent, ctx, m).music).toBe('victory')
  })

  it('says "the dead reach the gate" once per round', () => {
    const m = memo()
    const ev = { type: 'ZombieAdded', location: 'colony', entrance: 0, source: 'colonyStep', zombies: 1 } as GameEvent
    const state = { roundNumber: 3 } as never
    expect(planEvent(ev, { viewer: 's1', state }, m).narration).toHaveLength(1)
    expect(planEvent(ev, { viewer: 's1', state }, m).narration).toHaveLength(0)
  })

  it('finds objective and Crossroads lines, and swells the moans with zombies', () => {
    expect(objectiveIntroLine('obj.main.kill-them')).toBe('nar-obj-kill-them')
    expect(objectiveIntroLine('obj.main.nope')).toBeNull()
    expect(crossroadsLine('xr.hunted')).toBe('vo-xr-hunted')
    expect(crossroadsLine('xr.not-voiced')).toBeNull()
    const entrances = (n: number) => ({ locations: { colony: { entrances: [{ zombies: n }] } } }) as never
    expect(ambienceLevels(entrances(8))['amb-moans-loop']!).toBeGreaterThan(ambienceLevels(entrances(0))['amb-moans-loop']!)
  })

  it('is silent and never throws without Web Audio (node, headless)', () => {
    const a = prepareBeatAudio([{ type: 'RoundStarted', roundNumber: 1, roundsLeft: 5 } as GameEvent], { objective: { id: 'obj.main.kill-them' } } as never, 's1')
    expect(a.holdMs).toBe(0)
    expect(() => a.play()).not.toThrow()
  })
})

describe('audio settings', () => {
  it('sanitises stored values', () => {
    expect(sanitizeAudioSettings(null)).toEqual(DEFAULT_AUDIO_SETTINGS)
    expect(sanitizeAudioSettings({ master: 5, music: -1, narrator: 0.3, muted: true })).toMatchObject({ master: 1, music: 0, narrator: 0.3, muted: true })
  })
})
