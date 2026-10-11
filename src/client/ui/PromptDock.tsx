// The prompt dock (50 §5): one form per decision kind. The text says what the decision is about and carries the engine's numbers
// (query.*, pending.context, pending.options[].odds). The dock opens only when the presentation is idle and the decision is the human's.
import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { describe, query, type Action, type PendingDecision, type SeatId, type SeatView } from '../../engine/index'
import { locName, nameOf, rec, seatNameOf } from '../data'
import { isPresentationIdle, usePresentedStore } from '../presentation/presentedStore'
import { dispatch, isBotDecision, isHumanDecision, legalFor, submitHumanVote, useGameStore, validateAction } from '../store/gameStore'
import { useTrueView } from '../store/hooks'
import { ContributePicker } from './ContributePicker'
import { CrossroadsCard } from '../cards/CrossroadsCard'
import { ItemCard } from '../cards/ItemCard'
import { SurvivorCard } from '../cards/SurvivorCard'
import * as T from './promptText'
import { TurnActionForm, describeAction, labelNamesOf } from './TurnActionForm'

type Loose = Record<string, unknown>
const ctxData = (pd: PendingDecision): Loose => (pd.context.data ?? {}) as Loose

// ---------- small shared pieces ----------
function Portrait({ id, selected, onClick }: { id: string; selected?: boolean; onClick?: () => void; extra?: string }): ReactElement {
  return (
    <button className={`portrait ${selected ? 'sel' : ''}`} onClick={onClick} data-testid={`portrait-${id}`}>
      <SurvivorCard id={id} size="pk" selected={selected} />
    </button>
  )
}

function Foot({ pd, children }: { pd: PendingDecision; children?: React.ReactNode }): ReactElement {
  return (
    <div className="dock-foot">
      {pd.canPass && <button className="btn" data-testid="prompt-pass" onClick={() => dispatch({ type: 'pass', decisionId: pd.id, seat: v0(pd) }, 'human')}>Pass</button>}
      <span className="spacer" />
      {children}
    </div>
  )
}
const v0 = (pd: PendingDecision): SeatId => (pd.seat === 'all' ? useGameStore.getState().viewer : pd.seat)

function RejectionLine({ pd }: { pd: PendingDecision }): ReactElement | null {
  const r = useGameStore((s) => s.lastRejection)
  return r && r.action?.decisionId === pd.id ? <div className="err">{r.text}</div> : null
}

const answer = (a: Action): void => { dispatch(a, 'human') }
const optionActions = (pd: PendingDecision, legal: Action[]): { id: string; label: string; action: Action }[] =>
  pd.options?.length ? pd.options.map((o) => ({ id: o.id, label: o.label, action: o.action })) : legal.map((a, i) => ({ id: String(i), label: '', action: a }))

// ---------- forms ----------
function ChooseSurvivorsForm({ pd, v }: { pd: PendingDecision; v: SeatView }): ReactElement {
  const data = ctxData(pd)
  const offered = ((data['offered'] as string[] | undefined) ?? v.me.offered) ?? []
  const keep = (data['keep'] as number | undefined) ?? 2
  const [sel, setSel] = useState<string[]>([])
  const toggle = (id: string): void => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= keep ? [...s.slice(1), id] : [...s, id]))
  const action: Action = { type: 'chooseSurvivors', decisionId: pd.id, seat: v.seat, keep: sel }
  return (
    <>
      <div className="dock-head"><h3>Choose your survivors</h3></div>
      <div className="dock-body">
        <div className="dock-text" data-testid="prompt-text">{T.chooseSurvivorsText({ keep, offered: offered.length })}</div>
        <div className="portraits">{offered.map((id) => <Portrait key={id} id={id} selected={sel.includes(id)} onClick={() => toggle(id)} />)}</div>
      </div>
      <RejectionLine pd={pd} />
      <Foot pd={pd}><span className="muted">{sel.length} of {keep} picked</span>
        <button className="btn primary" data-primary data-testid="prompt-confirm" disabled={sel.length !== keep} onClick={() => answer(action)}>Keep {sel.length === keep ? sel.map((s) => nameOf(s).split(' ')[0]).join(' and ') : 'these'}</button>
      </Foot>
    </>
  )
}

function LeaderForm({ pd, legal }: { pd: PendingDecision; legal: Action[] }): ReactElement {
  const opts = optionActions(pd, legal).filter((o) => o.action.type === 'chooseLeader')
  const [sel, setSel] = useState<string | null>(opts.length === 1 ? opts[0]!.id : null)
  const chosen = opts.find((o) => o.id === sel)
  return (
    <>
      <div className="dock-head"><h3>{pd.kind === 'newLeader' ? 'Pick a new leader' : 'Pick your leader'}</h3></div>
      <div className="dock-body">
        <div className="dock-text" data-testid="prompt-text">{T.leaderText()}</div>
        <div className="portraits">{opts.map((o) => <Portrait key={o.id} id={(o.action as unknown as { survivorId: string }).survivorId} selected={o.id === sel} onClick={() => setSel(o.id)} />)}</div>
      </div>
      <RejectionLine pd={pd} />
      <Foot pd={pd}><button className="btn primary" data-primary data-testid="prompt-confirm" disabled={!chosen} onClick={() => chosen && answer(chosen.action)}>Confirm leader</button></Foot>
    </>
  )
}

function KeepForm({ pd, v, legal }: { pd: PendingDecision; v: SeatView; legal: Action[] }): ReactElement {
  const opts = optionActions(pd, legal)
  const loc = pd.context.location ?? v.search?.location ?? 'colony'
  const cards = (pd.context.cardIds ?? []).map((c) => nameOf(v.cards[c]?.defId))
  let text = ''
  if (pd.kind === 'searchKeepOrNoise') {
    const l = v.locations[loc]
    let p = 0.5
    try { p = query.zombiesToAdd(v).noise[0]?.pZombiePerToken ?? 0.5 } catch { p = 0.5 }
    text = T.keepOrNoiseText({ card: cards[0] ?? 'this card', spacesLeft: l ? l.capacity.noiseSpaces - l.noise : 0, spaces: l?.capacity.noiseSpaces ?? 0, pZombie: p })
  } else text = T.keepWhichText({ cards })
  return (
    <>
      <div className="dock-head"><h3>Search: {locName(loc)}</h3></div>
      <div className="dock-body">
        <div className="dock-text" data-testid="prompt-text">{text}</div>
        <div className="opt-list">
          {opts.map((o) => {
            const cardId = (o.action as unknown as { cardId?: string }).cardId
            const defId = cardId ? v.cards[cardId]?.defId : undefined
            return (
              <button key={o.id} className={`opt ${defId ? 'card-opt' : ''}`} data-testid={`prompt-option-${o.id}`} onClick={() => answer(o.action)}>
                {defId && <ItemCard defId={defId} size="md" />}
                <b>{o.label || describeAction(v, o.action)}</b>
              </button>
            )
          })}
        </div>
      </div>
      <RejectionLine pd={pd} />
    </>
  )
}

function RequestResponseForm({ pd, v, legal }: { pd: PendingDecision; v: SeatView; legal: Action[] }): ReactElement {
  const opts = optionActions(pd, legal)
  const from = pd.context.seatId ?? v.request?.from ?? ''
  const want = pd.context.symbol ? `a ${pd.context.symbol} card` : v.request?.want.defId ? nameOf(v.request.want.defId) : 'a card'
  return (
    <>
      <div className="dock-head"><h3>{seatNameOf(v.setup, from)} asks you for a card</h3></div>
      <div className="dock-body">
        <div className="dock-text" data-testid="prompt-text">{T.requestResponseText({ from: seatNameOf(v.setup, from), want })}</div>
        <div className="opt-list">
          {opts.map((o) => {
            const give = (o.action as unknown as { give: string | null }).give
            const defId = give ? v.cards[give]?.defId : undefined
            return (
              <button key={o.id} className={`opt ${give === null ? '' : 'card-opt'}`} data-testid={`prompt-option-${o.id}`} onClick={() => answer(o.action)}>
                {give === null ? <b>Decline</b> : <><ItemCard defId={defId} size="sm" /> <b>Give {nameOf(defId)}</b></>}
              </button>
            )
          })}
        </div>
      </div>
      <RejectionLine pd={pd} />
    </>
  )
}

function CrossroadsForm({ pd, v, legal }: { pd: PendingDecision; v: SeatView; legal: Action[] }): ReactElement {
  const opts = optionActions(pd, legal)
  const cardId = pd.context.cardId ?? v.crossroads.active?.cardId
  const r = rec(cardId)
  const known = !!r?.['text']?.['options']
  return (
    <>
      <div className="dock-head"><h3>Crossroads: {nameOf(cardId)}</h3></div>
      <div className="dock-body">
        <div className="dock-text sr-only" data-testid="prompt-text">{(r?.['text']?.['vignette'] as string | undefined) ?? describe.decision(pd)}</div>
        {known ? (
          <CrossroadsCard
            id={cardId}
            size="xl"
            renderOption={(oid, _i, text) => {
              const o = opts.find((x) => ((x.action as unknown as { optionId?: string }).optionId ?? x.id) === oid)
              if (!o) return <p className="xr-opt">{text}</p>
              return (
                <button key={o.id} className="opt" data-testid={`prompt-option-${oid}`} onClick={() => answer(o.action)}>
                  <b>{o.label || oid}</b>{text && <div className="xr-opt" style={{ marginTop: 3 }}>{text}</div>}
                </button>
              )
            }}
          />
        ) : (
          <div className="opt-list">
            {opts.map((o) => {
              const id = (o.action as unknown as { optionId?: string }).optionId ?? o.id
              return <button key={o.id} className="opt" data-testid={`prompt-option-${id}`} onClick={() => answer(o.action)}><b>{o.label || id}</b></button>
            })}
          </div>
        )}
      </div>
      <RejectionLine pd={pd} />
    </>
  )
}

function BiteForm({ pd, v, legal }: { pd: PendingDecision; v: SeatView; legal: Action[] }): ReactElement {
  const opts = optionActions(pd, legal)
  const odds = pd.context.odds?.exposure ?? pd.options?.find((o) => o.odds?.exposure)?.odds?.exposure
  const text = T.biteSpreadText({
    survivor: nameOf(pd.context.survivorId), next: pd.context.targetId ? nameOf(pd.context.targetId) : null,
    blank: odds?.blank ?? 0.5, pDeath: odds?.pDeath ?? 0.5,
  })
  return (
    <>
      <div className="dock-head"><h3>The bite spreads at {locName(pd.context.location ?? v.bite?.location ?? 'colony')}</h3></div>
      <div className="dock-body">
        <div className="dock-text" data-testid="prompt-text">{text}</div>
        <div className="opt-list">
          {opts.map((o) => (
            <button key={o.id} className="opt" data-testid={`prompt-option-${o.id}`} onClick={() => answer(o.action)}>
              <b>{(o.action as unknown as { choice: string }).choice === 'kill' ? `Kill ${nameOf(pd.context.survivorId)}` : 'Roll the die'}</b>
              <div className="muted" style={{ fontSize: 12 }}>{o.label}</div>
            </button>
          ))}
        </div>
      </div>
      <RejectionLine pd={pd} />
    </>
  )
}

function ExileForm({ pd, v, legal }: { pd: PendingDecision; v: SeatView; legal: Action[] }): ReactElement {
  const toPlace = v.exile?.toPlace ?? []
  const targets = v.locationOrder.filter((l) => l !== 'colony')
  const first = legal.find((a) => a.type === 'placeExiled') as (Action & { placements: { survivorId: string; to: string }[] }) | undefined
  const [place, setPlace] = useState<Record<string, string>>(() => Object.fromEntries(toPlace.map((s) => [s, first?.placements.find((p) => p.survivorId === s)?.to ?? targets[0] ?? 'colony'])))
  const action: Action = { type: 'placeExiled', decisionId: pd.id, seat: v.seat, placements: toPlace.map((s) => ({ survivorId: s, to: place[s]! })) }
  const bad = useMemo(() => validateAction(action), [place]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div className="dock-head"><h3>You were exiled</h3></div>
      <div className="dock-body">
        <div className="dock-text" data-testid="prompt-text">{T.exileText({ names: toPlace.map(nameOf) })}</div>
        {toPlace.map((s) => (
          <label key={s} className="surv-row"><span className="who">{nameOf(s)}</span>
            <select value={place[s]} onChange={(e) => setPlace((p) => ({ ...p, [s]: e.target.value }))} data-testid={`exile-${s}`}>
              {targets.map((l) => {
                const loc = v.locations[l]
                return <option key={l} value={l}>{locName(l)} ({loc ? loc.capacity.survivors : 0} places)</option>
              })}
            </select>
          </label>
        ))}
      </div>
      <RejectionLine pd={pd} />
      <Foot pd={pd}>{bad && <span className="muted" style={{ fontSize: 11 }}>{bad.message}</span>}<button className="btn primary" data-primary data-testid="prompt-confirm" disabled={!!bad} onClick={() => answer(action)}>Place them</button></Foot>
    </>
  )
}

function VotesForm({ pd, v }: { pd: PendingDecision; v: SeatView }): ReactElement {
  const target = (pd.context.seatId ?? '') as SeatId
  const f = query.voteForecast(v, target)
  const caller = (ctxData(pd)['caller'] as string | undefined) ?? ''
  return (
    <>
      <div className="dock-head"><h3>Vote: exile {seatNameOf(v.setup, target)}?</h3></div>
      <div className="dock-body">
        <div className="dock-text" data-testid="prompt-text">
          {caller ? `${seatNameOf(v.setup, caller)} called this vote. ` : ''}{T.votesText({ target: seatNameOf(v.setup, target), eligible: f.eligible.length, needed: f.needed, tiebreak: seatNameOf(v.setup, f.tiebreakBy) })}
        </div>
        <div className="muted">Ballots are secret until everyone has voted.</div>
      </div>
      <RejectionLine pd={pd} />
      <div className="dock-foot">
        <button className="btn danger" data-testid="prompt-option-yes" onClick={() => void submitHumanVote(true)}>Yes, exile</button>
        <button className="btn primary" data-primary data-testid="prompt-option-no" onClick={() => void submitHumanVote(false)}>No, keep</button>
      </div>
    </>
  )
}

function GenericForm({ pd, v, legal }: { pd: PendingDecision; v: SeatView; legal: Action[] }): ReactElement {
  const opts = optionActions(pd, legal)
  const code = (pd.context.data as { code?: string } | undefined)?.code
  const testMode = typeof location !== 'undefined' && new URLSearchParams(location.search).get('test') === '1'
  return (
    <>
      <div className="dock-head"><h3>{describe.decision(pd)}</h3>{testMode && code && <span className="tag">{code}</span>}</div>
      <div className="dock-body">
        <div className="dock-text" data-testid="prompt-text">
          {pd.kind === 'itemTarget' ? 'Pick what the item acts on.' : pd.kind === 'objectiveChoice' ? 'The objective asks you to choose.' : 'A card or ability asks you to choose.'}
        </div>
        <div className="opt-list">
          {opts.map((o) => {
            const tg = (o.action as unknown as { targets?: string[] }).targets
            const label = o.label || (tg ? tg.map((t) => nameOf(t)).join(', ') : describeAction(v, o.action))
            return <button key={o.id} className="opt" data-testid={`prompt-option-${o.id}`} onClick={() => answer(o.action)}>{label}</button>
          })}
        </div>
      </div>
      <RejectionLine pd={pd} />
      <Foot pd={pd} />
    </>
  )
}

function Form({ pd, v, legal }: { pd: PendingDecision; v: SeatView; legal: Action[] }): ReactElement {
  switch (pd.kind) {
    case 'chooseSurvivors': return <ChooseSurvivorsForm pd={pd} v={v} />
    case 'chooseLeader': case 'newLeader': return <LeaderForm pd={pd} legal={legal} />
    case 'turnAction': return <TurnActionForm pd={pd} v={v} legal={legal} />
    case 'searchKeepOrNoise': case 'searchKeepWhich': return <KeepForm pd={pd} v={v} legal={legal} />
    case 'crisisContribution': return <ContributePicker pd={pd} v={v} endsTurn />
    case 'requestResponse': return <RequestResponseForm pd={pd} v={v} legal={legal} />
    case 'crossroadsOption': return <CrossroadsForm pd={pd} v={v} legal={legal} />
    case 'biteSpreadOption': return <BiteForm pd={pd} v={v} legal={legal} />
    case 'exilePlacement': return <ExileForm pd={pd} v={v} legal={legal} />
    case 'votes': return <VotesForm pd={pd} v={v} />
    default: return <GenericForm pd={pd} v={v} legal={legal} />
  }
}

/** Every decision kind this dock has a dedicated form for (the rest use the generic option list); a test checks it covers the engine's kinds. */
export const PROMPT_FORM_KINDS = [
  'chooseSurvivors', 'chooseLeader', 'newLeader', 'turnAction', 'searchKeepOrNoise', 'searchKeepWhich', 'crisisContribution', 'requestResponse',
  'crossroadsOption', 'biteSpreadOption', 'exilePlacement', 'votes', 'objectiveChoice', 'effectChoice', 'itemTarget',
] as const

export function PromptDock(): ReactElement | null {
  const pending = useGameStore((s) => s.pending)
  const state = useGameStore((s) => s.state)
  const botVotes = useGameStore((s) => s.botVotes)
  const idle = usePresentedStore((s) => s.idle)
  const v = useTrueView()
  void botVotes
  // Enter confirms the primary button of the open form (50 §5)
  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      if (e.key !== 'Enter' || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      const b = document.querySelector<HTMLButtonElement>('.dock [data-primary]:not(:disabled)')
      if (b) { e.preventDefault(); b.click() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])
  if (!pending || !state || !v || pending.kind === 'gameOver') return null
  if (!idle || !isPresentationIdle()) return null
  const s = useGameStore.getState()
  if (isHumanDecision(s)) {
    // a vote the human already answered (cannot happen: the ballot is sent at once), or a vote that waits for bots
    const legal = legalFor(state)
    return (
      <div className={`dock panel ${pending.kind === 'votes' || pending.kind === 'biteSpreadOption' ? 'compact' : ''}`} key={pending.id} role="dialog" aria-label={describe.decision(pending)} data-testid="prompt-dock" data-kind={pending.kind}>
        <Form pd={pending} v={v} legal={legal} />
      </div>
    )
  }
  if (isBotDecision(s) || pending.seat === 'all') {
    const who = pending.seat === 'all' ? 'The table' : seatNameOf(state.setup, pending.seat)
    return <div className="bot-wait panel sans" data-testid="bot-wait">{who} is {pending.kind === 'votes' ? 'voting' : 'deciding'}...</div>
  }
  return null
}

