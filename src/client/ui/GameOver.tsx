// Recap (50 §15): winners and the reason, then every seat's secret objective with its parts, the contributions by crisis and seat,
// the Crossroads log and the final hands. This is how the human audits the bots: nothing is hidden once the game has ended.
import { useMemo, type ReactElement } from 'react'
import { query, type ObjectiveProgressReport, type SeatView } from '../../engine/index'
import { CrisisCard } from '../cards/CrisisCard'
import { ExiledCard, SecretObjectiveCard } from '../cards/ObjectiveCards'
import { nameOf, partLabel, rec, seatNameOf } from '../data'
import { usePresentedStore } from '../presentation/presentedStore'
import { exportSave, useGameStore } from '../store/gameStore'
import { useTrueView } from '../store/hooks'
import { seatColour } from '../table/seats'
import type { LaunchRequest } from '../launch'
import { randomSeedWord } from '../launch'

const REASON: Record<string, string> = {
  moraleZero: 'Morale fell to zero.', roundsOut: 'The rounds ran out.', objectiveComplete: 'The main objective was completed.', concession: 'The human conceded.',
}

function progress(v: SeatView, id: string): ObjectiveProgressReport | null {
  try { return query.objectiveProgress(v, id) } catch { return null }
}

export function requestFromView(v: SeatView, seed: string): LaunchRequest {
  return { seats: v.setup.seats.map((s) => s.kind), objective: v.setup.mainObjective, seed }
}

export function GameOver({ onRestart, onExit }: { onRestart: (req: LaunchRequest) => void; onExit: () => void }): ReactElement | null {
  const state = useGameStore((s) => s.state)
  const idle = usePresentedStore((s) => s.idle)
  const v = useTrueView()
  const recap = v?.recap
  const rows = useMemo(() => {
    if (!v || !recap) return []
    return v.seatOrder.map((id) => {
      const o = recap.secretObjectives[id]
      return { id, secret: o?.secret ?? null, exiled: o?.exiled ?? null, outcome: o?.outcome, sp: o?.secret ? progress(v, o.secret) : null, ep: o?.exiled ? progress(v, o.exiled) : null }
    })
  }, [v, recap])
  if (!state || state.phase !== 'ended' || !idle || !v || !recap) return null
  const name = (s: string): string => seatNameOf(v.setup, s)
  const winners = v.result?.winners ?? []
  const download = (): void => {
    const data = exportSave('Exported')
    if (!data) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `dead-of-winner-${state.seed}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <div className="over" data-testid="game-over">
      <div className="over-card panel sans">
        <h1>{winners.length ? `${winners.map(name).join(' and ')} won` : 'Nobody won'}</h1>
        <div className="muted">{REASON[v.result?.reason ?? ''] ?? ''} Main objective: {nameOf(v.objective.id)} ({v.result?.objectiveComplete ? 'complete' : 'not complete'}). Seed: <b>{state.seed}</b></div>
        <div className="over-grid">
          {rows.map((r) => (
            <div key={r.id} className="over-seat" style={{ borderLeftColor: seatColour(v.seatOrder, r.id) }} data-testid={`recap-seat-${r.id}`}>
              <h3>{name(r.id)}{r.id === v.seat ? ' (you)' : ''} <span className={`tag ${r.outcome === 'won' ? 'gold' : 'bad'}`}>{r.outcome ?? 'no result'}</span></h3>
              {r.secret ? (
                <>
                  <div className="recap-card"><SecretObjectiveCard id={r.secret} size="lg" /></div>
                  {rec(r.secret)?.['type'] === 'betrayal' ? <div><span className="tag bad">betrayer</span></div> : null}
                  {r.sp?.parts.map((p, i) => <div key={i} className="progress-part"><span>{partLabel(p.label)}</span><b>{p.have} of {p.need}</b></div>)}
                </>
              ) : <div className="muted">No secret objective.</div>}
              {r.exiled && (
                <div style={{ marginTop: 4 }}>
                  <div className="recap-card"><ExiledCard id={r.exiled} size="lg" /></div>
                  {r.ep?.parts.map((p, i) => <div key={i} className="progress-part"><span>{partLabel(p.label)}</span><b>{p.have} of {p.need}</b></div>)}
                </div>
              )}
              <div className="muted" style={{ marginTop: 4 }}>Final hand: {(recap.hands[r.id] ?? []).map((c) => nameOf(v.cards[c]?.defId)).join(', ') || 'empty'}</div>
            </div>
          ))}
        </div>
        <h3>Who put what into each crisis</h3>
        <table data-testid="recap-contributions">
          <thead><tr><th>Round</th><th>Crisis</th><th>Cards</th></tr></thead>
          <tbody>
            {recap.contributions.map((c, i) => (
              <tr key={i}><td>{c.roundNumber}</td><td>{nameOf(c.crisisId)}</td>
                <td>{c.revealed.map((r) => `${r.seat ? name(r.seat) : '?'} ${r.points > 0 ? '+1' : '-1'} (${nameOf(v.cards[r.cardId]?.defId)})`).join('; ') || 'nothing'}</td></tr>
            ))}
            {recap.contributions.length === 0 && <tr><td colSpan={3} className="muted">No crisis was resolved.</td></tr>}
          </tbody>
        </table>
        {recap.contributions.length > 0 && (
          <div className="card-strip" data-testid="recap-crisis-cards">
            {[...new Set(recap.contributions.map((c) => c.crisisId))].map((id) => <CrisisCard key={id} id={id} size="sm" />)}
          </div>
        )}
        <h3>Crossroads</h3>
        <table>
          <tbody>
            {recap.crossroads.map((c, i) => (
              <tr key={i}><td>Round {c.roundNumber}</td><td>{nameOf(c.cardId)}</td><td>held by {name(c.holder)} for {name(c.forSeat)}</td><td>{c.triggered ? `triggered${c.optionId ? `, option ${c.optionId}` : ''}` : 'never triggered'}</td></tr>
            ))}
            {recap.crossroads.length === 0 && <tr><td className="muted">No crossroads cards came up.</td></tr>}
          </tbody>
        </table>
        <div className="btns">
          <button className="btn primary" data-testid="recap-again" onClick={() => onRestart(requestFromView(v, randomSeedWord()))}>Play again</button>
          <button className="btn" data-testid="recap-same-seed" onClick={() => onRestart(requestFromView(v, state.seed))}>Same seed</button>
          <button className="btn" onClick={() => void navigator.clipboard?.writeText(state.seed)}>Copy seed</button>
          <button className="btn" onClick={download}>Export save</button>
          <button className="btn" onClick={onExit}>Title screen</button>
        </div>
      </div>
    </div>
  )
}
