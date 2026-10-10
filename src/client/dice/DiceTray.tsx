// Dice tray (50 §8): the human's action dice, food, the exposure d12 pocket, and a log of every roll this game.
// Every RollPurpose routes here through rollFromEvent (director) and renders with the same row; an unknown purpose renders generically.
import type { ReactElement } from 'react'
import { rollPurposeLabel } from '../presentation/feed'
import { usePresentedStore, type ShownRoll } from '../presentation/presentedStore'
import { useGameStore } from '../store/gameStore'
import { usePresentedView } from '../store/hooks'
import { seatNameOf } from '../data'

/** One log row: title, the dice, the target when the event carried one, the verdict word, the actor. */
export function rollRowText(r: ShownRoll): string {
  return `${r.title || rollPurposeLabel(r.purpose)}: ${r.dice.join(', ')}${r.target !== undefined ? ` (target ${r.target})` : ''}${r.verdict ? ` - ${r.verdict}` : ''} [${r.actor}]`
}

export function DiceTray(): ReactElement | null {
  const v = usePresentedView()
  const viewer = useGameStore((s) => s.viewer)
  const roll = usePresentedStore((s) => s.roll)
  const beat = usePresentedStore((s) => s.beat)
  const log = usePresentedStore((s) => s.diceLog)
  if (!v) return null
  const me = v.seats[viewer]
  const rolling = !!beat && (beat.kind === 'roll' || beat.kind === 'exposure') && !!roll
  const lastExposure = [...log].reverse().find((r) => r.purpose === 'exposure')
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
        <div className="die d12" title="Exposure die: last result" data-testid="tray-exposure">{lastExposure ? lastExposure.dice[0] : '?'}</div>
      </div>
      <div className="roll-now" data-testid="tray-roll">
        {roll ? (
          <>
            <span>{roll.title}{roll.seat ? ` (${seatNameOf(v.setup, roll.seat)})` : ` (${roll.actor})`}</span>
            {roll.dice.map((d, i) => <span key={i} className={`die ${rolling ? 'rolling' : ''}`} style={{ width: 24, height: 24, fontSize: 13 }}>{d}</span>)}
            {roll.target !== undefined && <span className="muted">target {roll.target}</span>}
            {roll.verdict && !rolling && <span className={`verdict ${roll.verdict}`}>{roll.verdict}</span>}
          </>
        ) : <span className="muted">Rolls appear here.</span>}
      </div>
      <div className="roll-log" data-testid="tray-log">
        {[...log].slice(-40).map((r, i) => (
          <div key={`${r.seq}-${i}`} title="Click to show this roll again" onClick={() => usePresentedStore.setState({ roll: { ...r, startedAt: performance.now() } })} data-testid={`tray-roll-${r.seq}`}>{rollRowText(r)}</div>
        ))}
      </div>
    </div>
  )
}
