// The `turnAction` prompt (50 §5, §6): a two-level dock. Level 1 lists what the human can do (only actions with a legal candidate, grouped
// by survivor, End turn always present); level 2 states exactly what a pick means with the engine's numbers, lets the human choose the die,
// and confirms. The client never invents an action: every Confirm dispatches one of the engine's legalActions.
import { useEffect, useMemo, useState, type ReactElement } from 'react'
import { describe, query, type Action, type PendingDecision, type SeatView } from '../../engine/index'
import { itemSymbols, itemText, locName, nameOf, seatNameOf, survivorAbility } from '../data'
import { dispatch, useGameStore } from '../store/gameStore'
import { ui, useUiStore } from '../store/uiStore'
import { ContributePicker } from './ContributePicker'
import { SymbolChips } from './Icons'
import { groupTurnActions, dieIdsOf, type Family, type LabelNames, type Variant } from './promptModel'
import * as T from './promptText'

export function labelNamesOf(v: SeatView): LabelNames {
  return {
    survivor: (id) => nameOf(id),
    loc: (id) => (id === 'colony' ? 'the Colony' : nameOf(id)),
    seat: (id) => seatNameOf(v.setup, id),
    card: (cardId) => nameOf(v.cards[cardId]?.defId),
  }
}

type Loose = Record<string, unknown>
const sidOf = (a: Action): string => ((a as unknown as Loose)['survivorId'] as string | undefined) ?? ''

function diceFor(v: SeatView, sid: string, kind: 'attack' | 'search' | 'any'): { need: number | null; dice: T.DieInfo[] } {
  const req = query.dieRequirement(v, sid, kind)
  const used = new Set((v.seats[v.seat]?.dice ?? []).filter((d) => d.used).map((d) => d.id))
  return { need: req.need, dice: req.dice.filter((d) => !used.has(d.dieId)).map((d) => ({ value: d.value, ok: d.ok, foodToReach: d.foodToReach })) }
}
const dieValue = (v: SeatView, dieId: string | undefined): number | null => (dieId ? v.seats[v.seat]?.dice.find((d) => d.id === dieId)?.value ?? null : null)
const exposureOf = (o: { blank: number; wound: number; frostbite: number; bite: number; pDeath: number } | undefined): T.ExposureLike | null => o ?? null

/** The sentence for one candidate action (exported for tests). */
export function describeAction(v: SeatView, a: Action): string {
  const N = labelNamesOf(v)
  const sid = sidOf(a)
  const who = nameOf(sid)
  switch (a.type) {
    case 'search': {
      const r = diceFor(v, sid, 'search')
      const loc = v.survivors[sid]?.location ?? 'colony'
      let likely: { symbol: string; p: number } | null = null
      try {
        const odds = query.searchOdds(v, loc).pSymbol
        const best = Object.entries(odds).sort((x, y) => y[1] - x[1])[0]
        if (best && best[1] > 0) likely = { symbol: best[0], p: best[1] }
      } catch { likely = null }
      return T.searchText({ who, where: N.loc(loc), need: r.need, dice: r.dice, likely })
    }
    case 'attack': {
      if (a.target.kind === 'zombie') {
        const r = diceFor(v, sid, 'attack')
        const k = query.zombieKillOdds(v, sid, a.target.location, a.target.entrance)
        const at = a.target.location === 'colony' ? `gate ${a.target.entrance}` : N.loc(a.target.location)
        return T.attackZombieText({ who, at, need: r.need, dice: r.dice, exposure: exposureOf(k.exposure) })
      }
      const o = query.attackSurvivorOdds(v, sid, a.target.survivorId)
      return T.attackSurvivorText({ who, target: nameOf(a.target.survivorId), die: dieValue(v, a.dieId), targetAttack: o.targetAttack, pHit: o.pHit, pKill: o.pKillTarget, stealsCard: o.stealsCard })
    }
    case 'move': {
      const mt = query.moveTargets(v, sid).find((t) => t.location === a.to)
      return T.moveText({ who, to: N.loc(a.to), emptySpaces: mt?.emptySpaces ?? 0, zombies: mt?.zombies ?? 0, exposure: exposureOf(mt?.exposure) })
    }
    case 'barricade': {
      const r = diceFor(v, sid, 'any')
      return T.barricadeText({ who, gate: `gate ${a.entrance}`, need: r.need, dice: r.dice })
    }
    case 'cleanWaste': return T.cleanWasteText({ who, waste: v.waste.length })
    case 'attract': {
      const loc = v.survivors[sid]?.location ?? 'colony'
      return T.attractText({
        who, where: N.loc(loc), total: a.from.reduce((n, f) => n + f.count, 0),
        from: a.from.map((f) => `${f.location === 'colony' ? `gate ${f.entrance}` : N.loc(f.location)} (${T.plural(v.locations[f.location]?.entrances.find((e) => e.index === f.entrance)?.zombies ?? f.count, 'zombie')})`),
      })
    }
    case 'useAbility': return T.abilityText({ who, ability: survivorAbility(sid) })
    case 'spendFood': return T.spendFoodText({ dieValue: dieValue(v, a.dieId), tokens: a.tokens, food: v.food, needed: query.foodNeeded(v).needed })
    case 'playCard': {
      const defId = v.cards[a.cardId]?.defId
      return T.playCardText({ card: nameOf(defId), text: itemText(defId), equipTo: a.equipTo ? nameOf(a.equipTo) : null })
    }
    case 'contributeObjective': {
      const o = v.objective
      return T.objectiveCardText({ card: nameOf(v.cards[a.cardId]?.defId), objective: nameOf(o.id), have: Object.entries(o.counters).map(([k, n]) => `${k} ${n}`).join(', ') })
    }
    case 'request': return T.requestText({ to: N.seat(a.to), want: a.defId ? nameOf(a.defId) : a.symbol ? `a ${a.symbol} card` : 'a card', handCount: v.seats[a.to]?.handCount ?? 0 })
    case 'handOff': {
      const from = Object.values(v.survivors).find((s) => s.equipped.includes(a.cardId))
      return T.handOffText({ card: nameOf(v.cards[a.cardId]?.defId), from: nameOf(from?.id), to: nameOf(a.toSurvivorId) })
    }
    case 'callVote': {
      const f = query.voteForecast(v, a.target)
      return T.callVoteText({ target: N.seat(a.target), eligible: f.eligible.length, needed: f.needed, tiebreak: N.seat(f.tiebreakBy) })
    }
    case 'endTurn': return T.endTurnText({ diceLeft: (v.seats[v.seat]?.dice ?? []).filter((d) => !d.used).length })
    default: return describe.decision({ kind: 'turnAction' } as PendingDecision)
  }
}

export function TurnActionForm({ pd, v, legal }: { pd: PendingDecision; v: SeatView; legal: Action[] }): ReactElement {
  const N = useMemo(() => labelNamesOf(v), [v])
  const families = useMemo(() => groupTurnActions(legal, N), [legal, N])
  const lastRej = useGameStore((s) => s.lastRejection)
  const selectedSurvivor = useUiStore((s) => s.selectedSurvivor)
  const selectedCard = useUiStore((s) => s.selectedCard)
  const dockReset = useUiStore((s) => s.dockReset)
  const [famKey, setFamKey] = useState<string | null>(null)
  const [varKey, setVarKey] = useState<string | null>(null)
  const [dieIdx, setDieIdx] = useState(0)
  const [contrib, setContrib] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)

  const endTurn = legal.find((a) => a.type === 'endTurn')
  const canContribute = legal.some((a) => a.type === 'contributeCrisis')
  const fam: Family | null = families.find((f) => f.key === famKey) ?? null
  const variant: Variant | null = fam ? fam.variants.find((x) => x.key === varKey) ?? fam.variants[0] ?? null : null

  const open = (f: Family): void => { setFamKey(f.key); setVarKey(f.variants[0]?.key ?? null); setDieIdx(0); setContrib(false); setConfirmEnd(false) }
  const back = (): void => { setFamKey(null); setVarKey(null); setContrib(false); setConfirmEnd(false); ui.set({ selectedCard: null }) }

  // a card clicked in the hand fan opens its play prompt
  useEffect(() => {
    if (!selectedCard) return
    const f = families.find((x) => x.key === `card:${selectedCard}`)
    if (f) open(f)
  }, [selectedCard]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { back() }, [dockReset]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const h = (e: KeyboardEvent): void => { if (e.key === 'Escape' && (famKey || contrib || confirmEnd)) { e.stopPropagation(); back() } }
    window.addEventListener('keydown', h, true)
    return () => window.removeEventListener('keydown', h, true)
  }, [famKey, contrib, confirmEnd])

  // default to the lowest qualifying die: keep the high ones for later
  const dieOrder = useMemo(() => {
    if (!variant) return []
    return variant.actions.map((a, i) => ({ i, value: dieValue(v, (a as unknown as Loose)['dieId'] as string | undefined) ?? 99 })).sort((x, y) => x.value - y.value)
  }, [variant, v])
  useEffect(() => { setDieIdx(dieOrder[0]?.i ?? 0) }, [variant?.key, dieOrder]) // eslint-disable-line react-hooks/exhaustive-deps
  const chosen: Action | null = variant ? variant.actions[Math.min(dieIdx, variant.actions.length - 1)] ?? null : null

  const submit = (a: Action): void => { dispatch(a, 'human') }
  const myDice = v.seats[v.seat]?.dice ?? []
  const diceLeft = myDice.filter((d) => !d.used).length
  const rejText = lastRej && lastRej.action?.decisionId === pd.id ? lastRej.text : null

  // ----- contribution picker -----
  if (contrib) return <ContributePicker pd={pd} v={v} endsTurn={false} onBack={back} />

  // ----- level 2: one family -----
  if (fam && variant && chosen) {
    const dieIds = dieIdsOf(variant)
    return (
      <>
        <div className="dock-head"><h3>{fam.label}{fam.survivorId ? `: ${nameOf(fam.survivorId)}` : ''}</h3></div>
        <div className="dock-body">
          {fam.variants.length > 1 && (
            <div className="opt-list">
              {fam.variants.map((x) => (
                <button key={x.key} className={`opt ${x.key === variant.key ? 'sel' : ''}`} onClick={() => { setVarKey(x.key); setDieIdx(0) }}>{x.label}</button>
              ))}
            </div>
          )}
          <div className="dock-text" data-testid="prompt-text">{describeAction(v, chosen)}</div>
          {dieIds.length > 1 && (
            <div className="row" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span className="muted">Use die:</span>
              {variant.actions.map((a, i) => (
                <button key={i} className={`btn chip ${i === dieIdx ? 'sel' : ''}`} onClick={() => setDieIdx(i)}>
                  {dieValue(v, (a as unknown as Loose)['dieId'] as string | undefined) ?? '?'}
                </button>
              ))}
            </div>
          )}
        </div>
        {rejText && <div className="err">{rejText}</div>}
        <div className="dock-foot">
          <button className="btn" onClick={back}>Back</button>
          <span className="spacer" />
          <button className="btn primary" data-primary data-testid="prompt-confirm" onClick={() => submit(chosen)}>Confirm</button>
        </div>
      </>
    )
  }

  // ----- end-turn confirm when dice are left -----
  if (confirmEnd && endTurn) {
    return (
      <>
        <div className="dock-head"><h3>End turn</h3></div>
        <div className="dock-body"><div className="dock-text">{T.endTurnText({ diceLeft })}</div></div>
        <div className="dock-foot">
          <button className="btn" onClick={back}>Keep playing</button>
          <span className="spacer" />
          <button className="btn primary" data-primary data-testid="prompt-end-turn-confirm" onClick={() => submit(endTurn)}>End turn</button>
        </div>
      </>
    )
  }

  // ----- level 1: the action list -----
  const mine = v.seats[v.seat]?.survivors ?? []
  const byS = (sid: string): Family[] => families.filter((f) => f.survivorId === sid)
  const globals = families.filter((f) => f.survivorId === null)
  const cardFams = globals.filter((f) => f.type === 'playCard')
  const otherGlobals = globals.filter((f) => f.type !== 'playCard')
  const ordered = [...mine].sort((a, b) => (a === selectedSurvivor ? -1 : b === selectedSurvivor ? 1 : 0))
  return (
    <>
      <div className="dock-head">
        <h3>Your move</h3>
        <span className="muted">{T.plural(diceLeft, 'die', 'dice')} left, {v.food} food</span>
      </div>
      <div className="dock-body">
        {ordered.map((sid) => {
          const s = v.survivors[sid]
          const fs = byS(sid)
          return (
            <div key={sid} className={`surv-row ${sid === selectedSurvivor ? 'sel' : ''}`} onMouseEnter={() => ui.set({ hoverSurvivor: sid })} onMouseLeave={() => ui.set({ hoverSurvivor: null })}>
              <div className="who">{nameOf(sid)}<div className="where">{locName(s?.location ?? 'colony')}{s && (s.wounds || s.frostbite) ? `, ${s.wounds}w ${s.frostbite}f` : ''}</div></div>
              {fs.length === 0 && <span className="muted">no action available</span>}
              {fs.map((f) => <button key={f.key} className="btn chip" onClick={() => open(f)} data-testid={`action-${f.key}`}>{f.label}</button>)}
            </div>
          )
        })}
        {(cardFams.length > 0 || otherGlobals.length > 0 || canContribute) && (
          <div className="surv-row">
            <div className="who">Table</div>
            {cardFams.map((f) => {
              const defId = f.key.startsWith('card:') ? v.cards[f.key.slice(5)]?.defId : undefined
              return <button key={f.key} className="btn chip" onClick={() => open(f)} data-testid={`action-${f.key}`}><SymbolChips symbols={itemSymbols(defId)} size={12} /> Play {nameOf(defId)}</button>
            })}
            {otherGlobals.map((f) => <button key={f.key} className="btn chip" onClick={() => open(f)} data-testid={`action-${f.key}`}>{f.label}</button>)}
            {canContribute && <button className="btn chip" onClick={() => setContrib(true)} data-testid="action-contribute">Add to crisis</button>}
          </div>
        )}
      </div>
      {rejText && <div className="err">{rejText}</div>}
      <div className="dock-foot">
        <span className="muted">Click a survivor on the table to bring them to the top.</span>
        <span className="spacer" />
        {endTurn && (
          <button className="btn primary" data-testid="prompt-end-turn" onClick={() => (diceLeft > 0 ? setConfirmEnd(true) : submit(endTurn))}>End turn</button>
        )}
      </div>
    </>
  )
}
