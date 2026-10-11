// Dice tray (50 §8): the human's action dice, food, the exposure d12 pocket, and a log of every roll this game.
// Every RollPurpose routes here through rollFromEvent (director) and renders with the same row; an unknown purpose renders generically.
// Rolls animate: the dice tumble and flicker through faces for the length of the beat, then land on the engine's number.
import type { ReactElement } from 'react'
import { rollPurposeLabel } from '../presentation/feed'
import { usePresentedStore, type ShownRoll } from '../presentation/presentedStore'
import { useGameStore } from '../store/gameStore'
import { usePresentedView } from '../store/hooks'
import { seatNameOf } from '../data'
import { RollingDie, useRolling } from './RollingDie'

/** One log row: title, the dice, the target when the event carried one, the verdict word, the actor. */
export function rollRowText(r: ShownRoll): string {
  return `${r.title || rollPurposeLabel(r.purpose)}: ${r.dice.join(', ')}${r.target !== undefined ? ` (target ${r.target})` : ''}${r.verdict ? ` - ${r.verdict}` : ''} [${r.actor}]`
}

export function DiceTray(): ReactElement | null {
  const v = usePresentedView()
  const viewer = useGameStore((s) => s.viewer)
  const roll = usePresentedStore((s) => s.roll)
  const log = usePresentedStore((s) => s.diceLog)
  const rolling = useRolling(roll ? `${roll.seq}:${roll.purpose}` : 'none', roll?.startedAt ?? 0, roll?.durationMs ?? 0)
  if (!v) return null
  const me = v.seats[viewer]
  const lastExposure = [...log].reverse().find((r) => r.purpose === 'exposure')
  const exposureNow = roll?.purpose === 'exposure' ? roll : lastExposure
  const exposureRolling = rolling && roll?.purpose === 'exposure'
  const dieRolling = rolling && !!roll && roll.purpose !== 'exposure'
  return (
    <div className="tray panel" data-testid="dice-tray">
      <h5><span>Your dice</span><span>Food {v.food}</span></h5>
      <div className="dice-row" data-testid="tray-dice">
        {me?.dice.map((d) => (
          <div key={d.id} className={`die ${d.used ? 'used' : ''}`} title={d.used ? 'used' : 'unused'} data-testid={`die-${d.id}`}>
            {d.value}{d.foodSpent ? <span className="food">+{d.foodSpent}</span> : null}
          </div>
        ))}
        {(me?.dice.length ?? 0) === 0 && <span className="muted">No dice yet.</span>}
        <div className="d12-pocket" title="Exposure die: the last result" data-testid="tray-exposure">
          <RollingDie value={exposureNow ? exposureNow.dice[0]! : '?'} sides={12} rolling={exposureRolling} size={42} testId="tray-exposure-die" />
        </div>
      </div>
      <div className="roll-now" data-testid="tray-roll">
        {roll ? (
          <>
            <span className="rn-title">{roll.title}{roll.seat ? ` (${seatNameOf(v.setup, roll.seat)})` : ` (${roll.actor})`}</span>
            {roll.purpose !== 'exposure' && roll.dice.map((d, i) => <RollingDie key={`${roll.seq}-${i}`} value={d} rolling={dieRolling} size={24} className="mini" />)}
            {roll.target !== undefined && <span className="muted">target {roll.target}</span>}
            {roll.verdict && !rolling && <span className={`verdict ${roll.verdict}`} data-testid="tray-verdict">{roll.verdict}</span>}
            {roll.note && !rolling && <span className="rn-note" data-testid="tray-odds">{roll.note}</span>}
          </>
        ) : <span className="muted">Rolls appear here.</span>}
      </div>
      <div className="roll-log" data-testid="tray-log">
        {[...log].slice(-40).map((r, i) => (
          <div key={`${r.seq}-${i}`} title="Click to show this roll again" onClick={() => usePresentedStore.setState({ roll: { ...r, startedAt: performance.now(), durationMs: Math.max(r.durationMs, 500) } })} data-testid={`tray-roll-${r.seq}`}>{rollRowText(r)}</div>
        ))}
      </div>
    </div>
  )
}
