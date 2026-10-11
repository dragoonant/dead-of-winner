// ?cards: every card type on one sheet (survivors, items, crises, objectives, Crossroads) for owner review and screenshots.
import { useEffect, useState, type ReactElement } from 'react'
import type { DataBundle } from '../../data/types'
import { setClientBundle } from '../data'
import { loadClientBundle } from '../dataLoad'
import '../ui/hud.css'
import './cards.css'
import { CrisisCard } from './CrisisCard'
import { CrossroadsCard } from './CrossroadsCard'
import { ItemCard } from './ItemCard'
import { BetrayalCard, ExiledCard, MainObjectiveCard, SecretObjectiveCard } from './ObjectiveCards'
import { SurvivorCard } from './SurvivorCard'

export const cardsRequested = (search = typeof location !== 'undefined' ? location.search : ''): boolean => new URLSearchParams(search).has('cards')

const pick = <T,>(xs: readonly T[], n: number): T[] => xs.slice(0, n)

export default function CardSheet(): ReactElement {
  const [b, setB] = useState<DataBundle | null>(null)
  useEffect(() => { void loadClientBundle().then((x) => { setClientBundle(x); setB(x) }) }, [])
  if (!b) return <div className="sheet" data-testid="card-sheet">Loading the card data...</div>
  const r = b.records
  // a spread of symbols, classes and name lengths
  const items = ['it.baseball-bat', 'it.survivors-cookbook', 'it.tikka-t3-tactical-rifle', 'it.medicine', 'it.fuel', 'it.food-2'].filter((id) => b.byId[id])
  const crises = ['cr.zombie-wave', 'cr.blizzard', 'cr.fuel-shortage', 'cr.empty-pantry'].filter((id) => b.byId[id])
  const secret = r.secretObjectives.filter((o) => o.type === 'secret')
  const betrayal = r.secretObjectives.filter((o) => o.type === 'betrayal')
  const exiled = r.secretObjectives.filter((o) => o.type === 'exiled')
  return (
    <div className="sheet" data-testid="card-sheet">
      <h1>Dead of Winner: card sheet</h1>
      <h2>Survivors</h2>
      <div className="row">{pick(r.survivors, 5).map((s) => <SurvivorCard key={s.id} id={s.id} size="lg" />)}</div>
      <h2>Items</h2>
      <div className="row">{items.map((id) => <ItemCard key={id} defId={id} size="lg" />)}</div>
      <h2>Crises</h2>
      <div className="row">{crises.map((id) => <CrisisCard key={id} id={id} size="lg" />)}</div>
      <h2>Objectives</h2>
      <div className="row">
        {r.mainObjectives[0] && <MainObjectiveCard id={r.mainObjectives[0].id} size="lg" />}
        {r.mainObjectives[3] && <MainObjectiveCard id={r.mainObjectives[3].id} size="lg" />}
        {secret[0] && <SecretObjectiveCard id={secret[0].id} size="xl" />}
        {betrayal[0] && <BetrayalCard id={betrayal[0].id} size="xl" />}
        {exiled[0] && <ExiledCard id={exiled[0].id} size="xl" />}
      </div>
      <h2>Crossroads</h2>
      <div className="row">{pick(r.crossroads, 2).map((c) => <CrossroadsCard key={c.id} id={c.id} size="xl" />)}</div>
    </div>
  )
}
