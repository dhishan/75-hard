import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '@/api/client'
import { useProgramStore } from '@/store/program'
import type { TaskCompletion, TaskDefinition, DailyLog as DailyLogType, UserProgram } from '@/types'
import TaskCard from '@/components/TaskCard'
import EvidenceUpload from '@/components/EvidenceUpload'

type Tab = 'all' | 'fitness' | 'mindset'

function formatDate(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-').map(Number)
    const d = new Date(year, month - 1, day)
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  } catch {
    return dateStr
  }
}

export default function DailyLog() {
  const { date } = useParams<{ date: string }>()
  const navigate = useNavigate()
  const { activeRun, setActiveRun } = useProgramStore()
  const [completions, setCompletions] = useState<TaskCompletion[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<DailyLogType | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('all')

  const tasks: TaskDefinition[] =
    ((activeRun?.program_snapshot as Record<string, unknown>)?.tasks as TaskDefinition[]) ?? []

  useEffect(() => {
    if (!activeRun) {
      api.get<UserProgram[]>('/user-programs').then((res) => {
        const active = res.data.find((r) => r.status === 'active')
        if (active) setActiveRun(active)
      })
    }
  }, [])

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
    setSaveError(null)
    try {
      const { data } = await api.put<DailyLogType>(
        `/user-programs/${activeRun.id}/logs/${date}`,
        { task_completions: completions }
      )
      setSaved(data)
    } catch {
      setSaveError('Save failed — please try again')
    } finally {
      setSaving(false)
    }
  }

  const updateCompletion = (index: number, updated: TaskCompletion) => {
    setCompletions((prev) => prev.map((c, i) => (i === index ? updated : c)))
  }

  const filteredIndices = tasks
    .map((task, i) => ({ task, i }))
    .filter(({ task }) => {
      if (activeTab === 'all') return true
      if (activeTab === 'fitness') return task.category === 'fitness'
      if (activeTab === 'mindset') return task.category === 'mindset'
      return true
    })

  const completedCount = completions.filter((c) => c.completed).length
  const totalCount = tasks.length

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: 'All Tasks' },
    { key: 'fitness', label: 'Fitness' },
    { key: 'mindset', label: 'Mindset' },
  ]

  return (
    <div className="min-h-screen bg-[#f6fafe]">
      {/* Save banner */}
      {saveError && (
        <div className="px-4 py-3 text-sm font-medium flex items-center gap-2 bg-[#fef2f2] text-[#b91c1c]">
          <span className="material-symbols-outlined text-base">error</span>
          {saveError}
        </div>
      )}
      {saved && (
        <div
          className={`px-4 py-3 text-sm font-medium flex items-center gap-2 ${
            saved.is_complete
              ? 'bg-[#e6f4ef] text-[#006947]'
              : 'bg-[#fef2f2] text-[#b91c1c]'
          }`}
        >
          <span className="material-symbols-outlined text-base">
            {saved.is_complete ? 'check_circle' : 'warning'}
          </span>
          {saved.is_complete
            ? `Day complete! +${saved.summary_points} pts`
            : `Incomplete — ${saved.penalty_applied} penalty day(s) added`}
        </div>
      )}

      <div className="max-w-xl mx-auto px-4 pb-32 safe-top" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-9 h-9 rounded-full bg-[#eaeef2] flex items-center justify-center text-[#171c1f] hover:bg-[#dfe3e7] transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>arrow_back</span>
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-[#171c1f]">
              Log — {date ? formatDate(date) : ''}
            </h1>
          </div>
          <span className="text-sm text-[#545f73]">{date}</span>
        </div>

        {/* Day / Streak badges */}
        {activeRun && date && (() => {
          const startDate = new Date(activeRun.start_date as unknown as string)
          const logDate = new Date(date)
          const dayNum = Math.max(1, Math.round((logDate.getTime() - startDate.getTime()) / 86400000) + 1)
          return (
            <div className="flex gap-2 mb-5">
              <span className="bg-[#0058be] text-white text-xs font-bold px-3 py-1.5 rounded-full tracking-wide">
                DAY {dayNum}
              </span>
              <span className="bg-[#eaeef2] text-[#171c1f] text-xs font-bold px-3 py-1.5 rounded-full tracking-wide">
                {dayNum} / {activeRun.total_days_required}
              </span>
            </div>
          )
        })()}

        {/* Tab navigation */}
        <div className="flex gap-1 bg-[#eaeef2] p-1 rounded-full mb-5">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                activeTab === key
                  ? 'bg-[#0058be] text-white'
                  : 'text-[#545f73] hover:text-[#171c1f]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Task cards */}
        <div>
          {filteredIndices.length === 0 ? (
            <div className="text-center py-12 text-[#6f7a8d] text-sm">
              No tasks in this category
            </div>
          ) : (
            filteredIndices.map(({ task, i }) => (
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
            ))
          )}
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#c2c6d6] px-4 pt-4 pb-4 shadow-lg safe-bottom">
        <div className="max-w-xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-[#545f73] font-medium">
              {completedCount} / {totalCount} tasks
            </span>
            <div className="flex-1 mx-3 bg-[#eaeef2] rounded-full h-2">
              <div
                className="bg-[#0058be] h-2 rounded-full transition-all"
                style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%' }}
              />
            </div>
            <span className="text-sm text-[#0058be] font-semibold">
              {totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}%
            </span>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-[#0058be] text-white rounded-full font-semibold text-sm tracking-wide disabled:opacity-50 hover:bg-[#2170e4] transition-colors"
          >
            {saving ? 'Saving...' : 'SAVE DAILY LOG'}
          </button>
        </div>
      </div>
    </div>
  )
}
