// Recap (50 §15): winners and the reason, then for every seat the story of what they were really doing (secret objective and whether it was met,
// the betrayer reveal, the hidden crisis cards they put in, their Crossroads choices, the table's suspicion when the AI exposes it), the
// contributions by crisis and seat, the Crossroads log and the final hands. This is how the human audits the bots: nothing is hidden once the game has ended.
import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { query, type ObjectiveProgressReport, type SeatView } from '../../engine/index'
import { CrisisCard } from '../cards/CrisisCard'
import { SecretObjectiveCard } from '../cards/ObjectiveCards'
import { nameOf, partLabel, rec, seatNameOf } from '../data'
import { clip } from '../presentation/feed'
import { usePresentedStore } from '../presentation/presentedStore'
import { buildStory, type ContributionInfo, type CrossroadsInfo, type ObjectiveInfo, type SuspicionTrajectory } from '../recap/story'
import { loadSuspicion } from '../recap/suspicion'
import { exportSave, useGameStore } from '../store/gameStore'
import { useTrueView } from '../store/hooks'
import { seatColour, seatMark, usePalette } from '../table/seats'
import type { LaunchRequest } from '../launch'
import { randomSeedWord } from '../launch'

const REASON: Record<string, string> = {
  moraleZero: 'Morale fell to zero.', roundsOut: 'The rounds ran out.', objectiveComplete: 'The main objective was completed.', concession: 'The human conceded.',
}

function progress(v: SeatView, id: string): ObjectiveProgressReport | null {
  try { return query.objectiveProgress(v, id) } catch { return null }
}

export function requestFromView(v: SeatView, seed: string): LaunchRequest {
  const bots = v.setup.seats.filter((s) => s.kind === 'bot').map((s) => ({ ...(s.persona ? { persona: s.persona } : {}), ...(s.tier ? { tier: s.tier } : {}), ...(s.name ? { name: s.name } : {}) }))
  return { seats: v.setup.seats.map((s) => s.kind), objective: v.setup.mainObjective, seed, bots, ...(v.setup.variants ? { variants: v.setup.variants } : {}) }
}

function objectiveInfo(v: SeatView, id: string): ObjectiveInfo | null {
  const r = rec(id)
  if (!r) return null
  const p = progress(v, id)
  const type = (r['type'] as string | undefined) ?? 'secret'
  return {
    id, name: nameOf(id), kind: type === 'betrayal' ? 'betrayal' : type === 'exiled' ? 'exiled' : 'secret',
    complete: p ? p.complete : null, requiresMain: !!(r['requiresMain'] ?? p?.requiresMain),
    parts: (p?.parts ?? []).map((x) => ({ label: partLabel(x.label), have: x.have, need: x.need })), goal: (r['text']?.['goal'] as string | undefined) ?? '',
  }
}

const pctText = (p: number): string => `${Math.round(p * 100)}%`

export function GameOver({ onRestart, onExit }: { onRestart: (req: LaunchRequest) => void; onExit: () => void }): ReactElement | null {
  const state = useGameStore((s) => s.state)
  const idle = usePresentedStore((s) => s.idle)
  const v = useTrueView()
  const palette = usePalette()
  const recap = v?.recap
  const [suspicion, setSuspicion] = useState<SuspicionTrajectory | null>(null)
  const ended = !!state && state.phase === 'ended'
  useEffect(() => {
    if (!ended || !state) return
    let alive = true
    void loadSuspicion(state.seed).then((t) => { if (alive) setSuspicion(t) })
    return () => { alive = false }
  }, [ended, state])

  const stories = useMemo(() => {
    if (!v || !recap) return []
    const name = (s: string): string => seatNameOf(v.setup, s)
    const hist = new Map(v.crisis.history.map((h) => [`${h.roundNumber}|${h.cardId}`, h.result]))
    const contributions: ContributionInfo[] = recap.contributions.map((c) => {
      const res = hist.get(`${c.roundNumber}|${c.crisisId}`)
      return {
        roundNumber: c.roundNumber, crisisId: c.crisisId, crisisName: nameOf(c.crisisId),
        result: res ? { total: res.total, needed: res.needed, prevented: res.prevented, bonus: res.bonus } : null,
        revealed: c.revealed.map((r) => ({ seat: r.seat, points: r.points, cardName: nameOf(v.cards[r.cardId]?.defId) })),
      }
    })
    const crossroads: CrossroadsInfo[] = recap.crossroads.map((c) => ({
      roundNumber: c.roundNumber, cardName: nameOf(c.cardId), forSeat: c.forSeat, holder: c.holder, triggered: c.triggered, optionId: c.optionId ?? null,
      optionText: c.optionId ? clip(String(rec(c.cardId)?.['text']?.['options']?.[c.optionId] ?? c.optionId), 150) : '',
    }))
    return buildStory({
      viewer: v.seat, seatOrder: v.seatOrder, seatName: name,
      secret: (seat) => { const o = recap.secretObjectives[seat]; return { id: o?.secret ?? null, exiledId: o?.exiled ?? null, ...(o?.outcome ? { outcome: o.outcome } : {}) } },
      objective: (id) => objectiveInfo(v, id),
      contributions, crossroads, exiledSeats: v.seatOrder.filter((s) => v.seats[s]?.seat.exiled), mainComplete: !!v.result?.objectiveComplete, suspicion,
    }).map((st) => ({ ...st, secretId: recap.secretObjectives[st.seat]?.secret ?? null }))
  }, [v, recap, suspicion])
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
        <h2 className="story-title">What everyone was really doing</h2>
        <div className="story-grid" data-testid="recap-story">
          {stories.map((st) => {
            const mark = seatMark(v.seatOrder, st.seat, palette)
            return (
              <article key={st.seat} className="story" style={{ borderLeftColor: seatColour(v.seatOrder, st.seat, palette) }} data-testid={`recap-seat-${st.seat}`} data-betrayer={st.betrayer}>
                <h3>
                  {mark && <span style={{ color: seatColour(v.seatOrder, st.seat, palette) }}>{mark} </span>}{st.name}{st.seat === v.seat ? ' (you)' : ''}{' '}
                  <span className={`tag ${st.outcome === 'won' ? 'gold' : 'bad'}`}>{st.outcome ?? 'no result'}</span>
                  {st.betrayer && <span className="tag bad" data-testid="recap-betrayer">betrayer</span>}
                  {st.exiled && <span className="tag bad">exiled</span>}
                </h3>
                <div className="story-top">
                  {st.secretId ? <div className="recap-card"><SecretObjectiveCard id={st.secretId} size="sm" /></div> : null}
                  <ul className="story-lines" data-testid="recap-story-lines">{st.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
                </div>
                {st.crisis.length > 0 && (
                  <div className="story-crisis" data-testid="recap-seat-crisis">
                    {st.crisis.map((c, i) => (
                      <div key={i}><span className="muted">Round {c.round}, {c.crisis} ({c.verdict}):</span>{' '}
                        {c.cards.map((x, j) => <span key={j} className={`cc ${x.points < 0 ? 'neg' : ''}`}>{x.points > 0 ? '+1' : '-1'} {x.name}</span>)}
                      </div>
                    ))}
                  </div>
                )}
                {st.crossroads.length > 0 && (
                  <div className="story-xr" data-testid="recap-seat-crossroads">
                    {st.crossroads.map((x, i) => <div key={i}><b>Round {x.round}, {x.card}:</b> {x.text || 'chose an option'}</div>)}
                  </div>
                )}
                {st.suspicion.length > 0 && (
                  <div className="story-susp" data-testid="recap-suspicion">Table suspicion by round: {st.suspicion.map((s) => `R${s.round} ${pctText(s.average)}`).join(', ')}</div>
                )}
                <div className="muted" style={{ marginTop: 4 }}>Final hand: {(recap.hands[st.seat] ?? []).map((c) => nameOf(v.cards[c]?.defId)).join(', ') || 'empty'}</div>
              </article>
            )
          })}
        </div>
        <h3>Who put what into each crisis</h3>
        <table data-testid="recap-contributions">
          <thead><tr><th>Round</th><th>Crisis</th><th>Result</th>{v.seatOrder.map((s) => <th key={s}>{name(s)}</th>)}</tr></thead>
          <tbody>
            {recap.contributions.map((c, i) => {
              const res = v.crisis.history.find((h) => h.roundNumber === c.roundNumber && h.cardId === c.crisisId)?.result
              return (
                <tr key={i}><td>{c.roundNumber}</td><td>{nameOf(c.crisisId)}</td>
                  <td>{res ? `${res.total} of ${res.needed}: ${res.prevented ? 'prevented' : 'not prevented'}` : ''}</td>
                  {v.seatOrder.map((s) => (
                    <td key={s}>{c.revealed.filter((r) => r.seat === s).map((r) => `${r.points > 0 ? '+1' : '-1'} ${nameOf(v.cards[r.cardId]?.defId)}`).join('; ') || '-'}</td>
                  ))}
                </tr>
              )
            })}
            {recap.contributions.length === 0 && <tr><td colSpan={3 + v.seatOrder.length} className="muted">No crisis was resolved.</td></tr>}
          </tbody>
        </table>
        {recap.contributions.length > 0 && (
          <div className="card-strip" data-testid="recap-crisis-cards">
            {[...new Set(recap.contributions.map((c) => c.crisisId))].map((id) => <CrisisCard key={id} id={id} size="sm" />)}
          </div>
        )}
        <h3>Crossroads</h3>
        <table data-testid="recap-crossroads">
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
