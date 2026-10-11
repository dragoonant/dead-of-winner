// Pure UI state: panels, selection, camera preset. Never holds rules numbers.
import { create } from 'zustand'

export type CameraPreset = 1 | 2 | 3 | 4

export interface UiState {
  objectiveOpen: boolean
  howToOpen: boolean
  settingsOpen: boolean
  keysOpen: boolean
  selectedSurvivor: string | null
  selectedCard: string | null
  /** Cards ticked for the crisis contribution (ids of the human's own hand/equipped). */
  contribSel: string[]
  camera: CameraPreset
  /** Bumped to make the prompt dock fall back to its action list. */
  dockReset: number
  hoverSurvivor: string | null
  /** True while the crisis-contribution picker is open (the hand fan then toggles cards instead of playing them). */
  contribOpen: boolean
}

export const INITIAL_UI: UiState = {
  objectiveOpen: false, howToOpen: false, settingsOpen: false, keysOpen: false,
  selectedSurvivor: null, selectedCard: null, contribSel: [], camera: 1, dockReset: 0, hoverSurvivor: null, contribOpen: false,
}

export const useUiStore = create<UiState>(() => ({ ...INITIAL_UI }))

export const ui = {
  set(patch: Partial<UiState>): void { useUiStore.setState(patch) },
  reset(): void { useUiStore.setState({ ...INITIAL_UI }) },
  toggle(k: 'objectiveOpen' | 'howToOpen' | 'settingsOpen' | 'keysOpen'): void { useUiStore.setState((s) => ({ [k]: !s[k] }) as Partial<UiState>) },
  toggleContrib(cardId: string): void {
    useUiStore.setState((s) => ({ contribSel: s.contribSel.includes(cardId) ? s.contribSel.filter((c) => c !== cardId) : [...s.contribSel, cardId] }))
  },
}
