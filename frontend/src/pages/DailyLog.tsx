import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { useProgramStore } from '@/store/program'
import type { TaskCompletion, TaskDefinition, DailyLog as DailyLogType } from '@/types'
import TaskCard from '@/components/TaskCard'
import EvidenceUpload from '@/components/EvidenceUpload'

export default function DailyLog() {
  const { date } = useParams<{ date: string }>()
  const navigate = useNavigate()
  const { activeRun } = useProgramStore()
  const [completions, setCompletions] = useState<TaskCompletion[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<DailyLogType | null>(null)

  const tasks: TaskDefinition[] =
    ((activeRun?.program_snapshot as Record<string, unknown>)?.tasks as TaskDefinition[]) ?? []

  useEffect(() => {
    if (!activeRun || !date) return
    api
      .get<DailyLogType>(`/user-programs/${activeRun.id}/logs/${date}`)
      .then((r) => {
        const log = r.data
        if (log.task_completions.length > 0) {
          setCompletions(log.task_completions)
        } else {
          setCompletions(
            tasks.map((t) => ({
              task_id: t.id,
              completed: false,
              bonus_earned: false,
              points_earned: 0,
              evidence: [],
            }))
          )
        }
      })
  }, [activeRun, date])

  const handleSave = async () => {
    if (!activeRun || !date) return
    setSaving(true)
    const { data } = await api.put<DailyLogType>(
      `/user-programs/${activeRun.id}/logs/${date}`,
      { task_completions: completions }
    )
    setSaved(data)
    setSaving(false)
  }

  const updateCompletion = (index: number, updated: TaskCompletion) => {
    setCompletions((prev) => prev.map((c, i) => (i === index ? updated : c)))
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">Log — {date}</h1>
        <button onClick={() => navigate('/dashboard')} className="text-sm underline">
          ← Back
        </button>
      </div>

      <div className="space-y-3 mb-6">
        {tasks.map((task, i) => (
          <div key={task.id}>
            <TaskCard
              task={task}
              completion={
                completions[i] ?? {
                  task_id: task.id,
                  completed: false,
                  bonus_earned: false,
                  points_earned: 0,
                  evidence: [],
                }
              }
              onChange={(updated) => updateCompletion(i, updated)}
            />
            {activeRun &&
              date &&
              task.evidence_required &&
              completions[i]?.completed && (
                <EvidenceUpload
                  upId={activeRun.id}
                  logDate={date}
                  taskId={task.id}
                />
              )}
          </div>
        ))}
      </div>

      {saved && (
        <div
          className={`p-3 rounded-lg mb-4 text-sm font-medium ${
            saved.is_complete
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {saved.is_complete
            ? `✓ Day complete! +${saved.summary_points} pts`
            : `⚠ Incomplete — ${saved.penalty_applied} penalty day(s) added`}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Log'}
      </button>
    </div>
  )
}
