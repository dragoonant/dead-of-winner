// TS mirror of docs/spec/schemas/*.json (spec 20 §3). Hand-mirrored; tests/data/ checks the fixture against the schemas.
// Condition / effect / scope nodes reuse the frozen engine types (src/engine/hooks.ts), so data and engine agree by construction.
// Records are type aliases (not interfaces) so they stay assignable to the engine's `DataRecord` (index-signature) shape.
import type {
  AbilityLocation, ConditionNode, CountsAs, DescriptorCost, EffectNode, ScopeNode, UseLimit,
} from '../engine/hooks'
import type { EffectDuration, ExposureFace, Id, ItemSymbol, LocationId, WindowId } from '../engine/types'

export type RecordStatus = 'placeholder' | 'draft' | 'verified'
/** field path (dot path into the record) -> cite string, grammar in spec 20 §6 */
export type Sources = Record<string, string>

export type RecordBase = {
  id: Id
  name: string
  sources: Sources
  status: RecordStatus
  notes?: string
  tags?: string[]
}

export type AbilityKind = 'passive' | 'action' | 'triggered'
export type AbilityDef = {
  id: string
  kind: AbilityKind
  trigger?: WindowId
  location?: AbilityLocation
  when?: ConditionNode
  cost?: DescriptorCost
  limit?: UseLimit
  scope?: ScopeNode
  duration?: EffectDuration
  effect: EffectNode[]
  optional?: boolean
  countsAs?: CountsAs
}
export type TriggerDef = {
  id: string
  trigger: WindowId
  when?: ConditionNode
  scope?: ScopeNode
  effect: EffectNode[]
  optional?: boolean
  limit?: UseLimit
}
export type CounterDef = { need: number | 'perSeat'; perSeatMultiplier?: number }
export type Counters = Record<string, CounterDef>

// ---------- records ----------
export type SurvivorRecord = RecordBase & {
  kind: 'survivor'
  occupation: string
  set?: 'base'
  stats: { influence: number; attack: number; search: number }
  ability: AbilityDef | { unknown: true }
  crossroads?: Id
  coop: boolean
  text: { ability: string; bio?: string }
  art?: { portrait?: string; figure?: string }
}

export type ItemClass = 'wastePile' | 'event' | 'equip' | 'none'
export type ItemRecord = RecordBase & {
  kind: 'item'
  symbol: ItemSymbol
  symbols?: ItemSymbol[]
  class: ItemClass
  food?: number
  outsiders?: number
  play?: { when?: ConditionNode; cost?: DescriptorCost; effect: EffectNode[]; countsAs?: Exclude<CountsAs, 'cleanWaste'> }
  equipped?: AbilityDef[]
  text: { ability?: string; flavor?: string }
  art?: { image?: string }
}

export type DeckRecord = RecordBase & {
  kind: 'deck'
  size: number
  cards: { item: Id; count: number }[]
}

export type LocationRecord = RecordBase & {
  kind: 'location'
  number?: number
  spaces: { survivors: number; entrances: number; entranceSpaces: number; noise: number }
  symbolOrder: ItemSymbol[]
  deck: Id | null
  text?: { blurb?: string }
}

export type CrisisRecord = RecordBase & {
  kind: 'crisis'
  prevent: ItemSymbol[]
  need?: { perSeat: number; plus: number }
  fail: EffectNode[]
  bonus?: { extraCards: number; effect: EffectNode[] }
  text: { fail: string; bonus?: string; flavor?: string }
}

export type CrossroadsOption = { id: string; effect: EffectNode[]; requires?: ConditionNode; vote?: boolean }
export type CrossroadsRecord = RecordBase & {
  kind: 'crossroads'
  survivor?: Id
  mature: boolean
  coop?: boolean
  trigger: { point: WindowId; when: ConditionNode }
  options: [CrossroadsOption, CrossroadsOption]
  text: { vignette: string; trigger?: string; options: Record<string, string> }
  voice?: { vignette?: string }
}

export type ObjectiveSide = {
  morale: number
  rounds: number
  setup?: EffectNode[]
  counters?: Counters
  complete: ConditionNode
  triggers?: TriggerDef[]
  contributions?: { symbol: ItemSymbol; counter: string; exiledMayContribute?: boolean; excludeStarter?: boolean }[]
}
export type MainObjectiveRecord = RecordBase & {
  kind: 'mainObjective'
  code: string
  time: 'short' | 'medium' | 'long'
  sides: { normal: ObjectiveSide; hardcore: ObjectiveSide }
  text: {
    story?: string
    normal: { setup: string; victory: string }
    hardcore: { setup: string; victory: string }
  }
}

export type SecretObjectiveType = 'secret' | 'betrayal' | 'exiled'
export type BetrayerLever =
  | 'moraleZero' | 'killSurvivors' | 'zombiesAtColony' | 'exileOthers' | 'starve' | 'custom' | `hoard:${ItemSymbol}`
export type SecretObjectiveRecord = RecordBase & {
  kind: 'secretObjective'
  type: SecretObjectiveType
  ai?: { lever: BetrayerLever }
  code?: string
  requiresMain: boolean
  requiresOriginal?: boolean
  betrayer?: { firstCondition: ConditionNode }
  counters?: Counters
  complete: ConditionNode
  triggers?: TriggerDef[]
  setup?: EffectNode[]
  text: { goal: string; betrayer?: string; story?: string }
}

export type PersonaRecord = RecordBase & {
  kind: 'persona'
  blurb: string
  scalars: {
    generosity: number; risk: number; paranoia: number; trust: number; chattiness: number; bluffing: number
    voteThreshold: number; callThreshold: number
  }
  voice?: { libraryVoiceId: string; direction: string }
  portrait?: { file: string; direction: string }
  lines: Record<string, { text: string; voiced?: boolean }[]>
}

export type DataRecord =
  | SurvivorRecord | ItemRecord | DeckRecord | LocationRecord | CrisisRecord | CrossroadsRecord
  | MainObjectiveRecord | SecretObjectiveRecord | PersonaRecord
export type RecordKind = DataRecord['kind']

// ---------- bundle ----------
/** The source form (docs/spec/schemas/bundle.json): what the loader validates. */
export type RawBundle = {
  version: string
  records: {
    survivors: SurvivorRecord[]
    items: ItemRecord[]
    decks: DeckRecord[]
    locations: LocationRecord[]
    crises: CrisisRecord[]
    crossroads: CrossroadsRecord[]
    mainObjectives: MainObjectiveRecord[]
    secretObjectives: SecretObjectiveRecord[]
    personas: PersonaRecord[]
  }
  slices?: Record<string, Id[]>
}

/** The loaded bundle. `version` and `dataVersion` are `<semver>+<content hash>`: the engine registers by `version`
 *  (shape-compatible with the engine's placeholder `DataBundle {version, byId}`) and stamps it into GameState. */
export type DataBundle = {
  version: string
  dataVersion: string
  semver: string
  hash: string
  byId: Record<Id, DataRecord>
  records: RawBundle['records']
  /** slice name -> record ids it loads (referenced records included); `all` is every non-placeholder record */
  slices: Record<string, Id[]>
}

export type IssueSeverity = 'error' | 'warn'
export type DataIssue = { rule: string; severity: IssueSeverity; where: string; message: string }

/** Names registered as code hooks (spec 21 §11). */
export type HookNames = { conditions: string[]; effects: string[]; objectives: string[] }

export type { LocationId, ExposureFace }
