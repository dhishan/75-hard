import { create } from 'zustand'
import type { UserProgram, DailyLog } from '@/types'

interface ProgramState {
  activeRun: UserProgram | null
  todayLog: DailyLog | null
  setActiveRun: (run: UserProgram | null) => void
  setTodayLog: (log: DailyLog | null) => void
}

export const useProgramStore = create<ProgramState>((set) => ({
  activeRun: null,
  todayLog: null,
  setActiveRun: (run) => set({ activeRun: run }),
  setTodayLog: (log) => set({ todayLog: log }),
}))
