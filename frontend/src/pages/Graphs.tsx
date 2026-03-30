import { useNavigate } from 'react-router-dom'
import { useProgramStore } from '@/store/program'
import CompletionHeatmap from '@/components/charts/CompletionHeatmap'
import StreakChart from '@/components/charts/StreakChart'
import TaskRatesChart from '@/components/charts/TaskRatesChart'
import PointsChart from '@/components/charts/PointsChart'

export default function Graphs() {
  const navigate = useNavigate()
  const { activeRun } = useProgramStore()

  if (!activeRun) {
    return (
      <div className="p-8">
        No active run.{' '}
        <button onClick={() => navigate('/dashboard')} className="underline">
          Back
        </button>
      </div>
    )
  }

  const snapshot = activeRun.program_snapshot as Record<string, unknown>
  const pointsPerShield = (snapshot?.points_per_shield as number) ?? 1500

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Graphs</h1>
        <button onClick={() => navigate('/dashboard')} className="text-sm underline">
          ← Dashboard
        </button>
      </div>
      <CompletionHeatmap upId={activeRun.id} />
      <StreakChart upId={activeRun.id} />
      <TaskRatesChart upId={activeRun.id} />
      <PointsChart upId={activeRun.id} pointsPerShield={pointsPerShield} />
    </div>
  )
}
