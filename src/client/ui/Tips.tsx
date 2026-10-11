// One tutorial tip at a time, top centre under the top bar; "Got it" marks it seen (settings: dow.settings.tipsSeen).
import type { ReactElement } from 'react'
import { usePresentedStore } from '../presentation/presentedStore'
import { isHumanDecision, useGameStore } from '../store/gameStore'
import { useSettingsStore } from '../store/settingsStore'
import { pickTip } from './tipsModel'

export function Tips(): ReactElement | null {
  const tips = useSettingsStore((s) => s.tips)
  const seen = useSettingsStore((s) => s.tipsSeen)
  const set = useSettingsStore((s) => s.set)
  const pending = useGameStore((s) => s.pending)
  const state = useGameStore((s) => s.state)
  const botVotes = useGameStore((s) => s.botVotes)
  const humanBallot = useGameStore((s) => s.humanBallot)
  const idle = usePresentedStore((s) => s.idle)
  const crisisCards = usePresentedStore((s) => s.crisisReveal?.cards.length ?? 0)
  const exposureSeen = usePresentedStore((s) => s.feed.some((e) => e.group === 'exposure'))
  void botVotes
  void humanBallot
  const humanKind = idle && pending && state && pending.kind !== 'gameOver' && isHumanDecision() ? pending.kind : null
  const tip = pickTip({ humanKind, crisisCards, exposureSeen }, seen, tips)
  if (!tip) return null
  return (
    <div className="tip panel sans" role="status" data-testid="tip" data-tip={tip.id}>
      <b>{tip.title}</b>
      <span>{tip.text}</span>
      <button className="btn chip" data-testid="tip-dismiss" onClick={() => set({ tipsSeen: [...seen, tip.id] })}>Got it</button>
    </div>
  )
}
