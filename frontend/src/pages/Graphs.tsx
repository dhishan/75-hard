import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProgramStore } from '@/store/program'
import { api } from '@/api/client'
import type { UserProgram } from '@/types'
import CompletionHeatmap from '@/components/charts/CompletionHeatmap'
import StreakChart from '@/components/charts/StreakChart'
import TaskRatesChart from '@/components/charts/TaskRatesChart'
import PointsChart from '@/components/charts/PointsChart'

function SectionHeader({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="material-symbols-outlined text-[#0058be]" style={{ fontSize: '20px' }}>
        {icon}
      </span>
      <h2 className="text-sm font-semibold text-[#171c1f] uppercase tracking-wide">{title}</h2>
      <div className="flex-1 h-px bg-[#c2c6d6] ml-2" />
    </div>
  )
}

export default function Graphs() {
  const navigate = useNavigate()
  const { activeRun, setActiveRun } = useProgramStore()

  useEffect(() => {
    if (!activeRun) {
      api.get<UserProgram[]>('/user-programs').then((res) => {
        const active = res.data.find((r) => r.status === 'active')
        if (active) setActiveRun(active)
      })
    }
  }, [])

  if (!activeRun) {
    return (
      <div className="min-h-screen bg-[#f6fafe] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#545f73] mb-4">No active run.</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="text-[#0058be] font-medium text-sm hover:underline"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  const snapshot = activeRun.program_snapshot as Record<string, unknown>
  const pointsPerShield = (snapshot?.points_per_shield as number) ?? 1500

  const completionPct =
    activeRun.total_days_required > 0
      ? Math.round((activeRun.current_day / activeRun.total_days_required) * 100)
      : 0

  return (
    <div className="min-h-screen bg-[#f6fafe]">
      <div className="max-w-3xl mx-auto px-4 pt-6 pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-9 h-9 rounded-full bg-[#eaeef2] flex items-center justify-center text-[#171c1f] hover:bg-[#dfe3e7] transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_back</span>
          </button>
          <h1 className="text-xl font-semibold text-[#171c1f]">Insights</h1>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <div className="bg-white rounded-xl border border-[#c2c6d6] p-4 shadow-sm">
            <p className="text-xs text-[#545f73] uppercase tracking-wide mb-1">Current Day</p>
            <p className="text-3xl font-bold text-[#0058be]">{activeRun.current_day}</p>
            <p className="text-xs text-[#6f7a8d] mt-1">of {activeRun.total_days_required} days</p>
          </div>
          <div className="bg-white rounded-xl border border-[#c2c6d6] p-4 shadow-sm">
            <p className="text-xs text-[#545f73] uppercase tracking-wide mb-1">Completion</p>
            <p className="text-3xl font-bold text-[#006947]">{completionPct}%</p>
            <p className="text-xs text-[#6f7a8d] mt-1">
              {activeRun.total_points_earned.toLocaleString()} pts earned
            </p>
          </div>
        </div>

        {/* Heatmap */}
        <section className="mb-8">
          <SectionHeader title="Completion Heatmap" icon="grid_view" />
          <div className="bg-white rounded-xl border border-[#c2c6d6] p-4 shadow-sm">
            <CompletionHeatmap upId={activeRun.id} />
          </div>
        </section>

        {/* Streak chart */}
        <section className="mb-8">
          <SectionHeader title="Streak History" icon="local_fire_department" />
          <div className="bg-white rounded-xl border border-[#c2c6d6] p-4 shadow-sm">
            <StreakChart upId={activeRun.id} />
          </div>
        </section>

        {/* Task rates */}
        <section className="mb-8">
          <SectionHeader title="Task Completion Rates" icon="task_alt" />
          <div className="bg-white rounded-xl border border-[#c2c6d6] p-4 shadow-sm">
            <TaskRatesChart upId={activeRun.id} />
          </div>
        </section>

        {/* Points chart */}
        <section className="mb-8">
          <SectionHeader title="Points Over Time" icon="emoji_events" />
          <div className="bg-white rounded-xl border border-[#c2c6d6] p-4 shadow-sm">
            <PointsChart upId={activeRun.id} pointsPerShield={pointsPerShield} />
          </div>
        </section>
      </div>
    </div>
  )
}
