import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '@/firebase'
import { api } from '@/api/client'
import type { Program, UserProgram } from '@/types'

interface TaskDraft {
  name: string
  category: string
  type: string
  is_required: boolean
  completion_points: number
  bonus_points: number
  bonus_threshold_pct: number
  min_completion_pct: number
  target_value?: number
  unit?: string
  total_budget?: number
  sub_options: string[]
  order: number
}

const DEFAULT_TASKS: TaskDraft[] = [
  { name: 'No added sugar', category: 'nutrition', type: 'boolean', is_required: true, completion_points: 100, bonus_points: 0, bonus_threshold_pct: 1.0, min_completion_pct: 1.0, sub_options: [], order: 1 },
  { name: 'Workout', category: 'fitness', type: 'duration', is_required: true, completion_points: 100, bonus_points: 50, bonus_threshold_pct: 1.5, min_completion_pct: 1.0, target_value: 20, unit: 'min', sub_options: [], order: 2 },
  { name: 'Water', category: 'health', type: 'measurement', is_required: true, completion_points: 50, bonus_points: 0, bonus_threshold_pct: 1.0, min_completion_pct: 1.0, target_value: 3, unit: 'ltr', sub_options: [], order: 3 },
  { name: 'Study session', category: 'mindset', type: 'duration', is_required: true, completion_points: 75, bonus_points: 0, bonus_threshold_pct: 1.0, min_completion_pct: 1.0, target_value: 20, unit: 'min', sub_options: [], order: 4 },
  { name: 'Weight', category: 'health', type: 'measurement', is_required: false, completion_points: 10, bonus_points: 0, bonus_threshold_pct: 1.0, min_completion_pct: 1.0, unit: 'kg', sub_options: [], order: 5 },
  { name: 'News/Finance/Podcast', category: 'mindset', type: 'boolean', is_required: false, completion_points: 20, bonus_points: 0, bonus_threshold_pct: 1.0, min_completion_pct: 1.0, sub_options: ['news', 'finance', 'podcast'], order: 6 },
  { name: 'Skin care', category: 'health', type: 'boolean', is_required: false, completion_points: 15, bonus_points: 0, bonus_threshold_pct: 1.0, min_completion_pct: 1.0, sub_options: [], order: 7 },
]

export default function Programs() {
  const navigate = useNavigate()
  const [programs, setPrograms] = useState<Program[]>([])
  const [activeRunProgramIds, setActiveRunProgramIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('My 75 Hard')
  const [durationDays, setDurationDays] = useState(75)
  const [tasks, setTasks] = useState<TaskDraft[]>(DEFAULT_TASKS)
  const [creating, setCreating] = useState(false)

  useEffect(() => { loadData() }, [])

  function loadData() {
    setLoading(true)
    Promise.all([
      api.get<Program[]>('/programs'),
      api.get<UserProgram[]>('/user-programs'),
    ]).then(([progRes, runsRes]) => {
      setPrograms(progRes.data)
      const activeIds = new Set(
        runsRes.data.filter((r) => r.status === 'active').map((r) => r.program_id),
      )
      setActiveRunProgramIds(activeIds)
    }).finally(() => setLoading(false))
  }

  function updateTask(index: number, field: keyof TaskDraft, value: unknown) {
    setTasks((prev) => prev.map((t, i) => i === index ? { ...t, [field]: value } : t))
  }

  async function createProgram() {
    setCreating(true)
    try {
      const prog = await api.post<Program>('/programs', {
        name,
        duration_days: durationDays,
        points_per_shield: 1500,
        max_shields_per_week: 1,
      })
      for (const task of tasks) {
        await api.post(`/programs/${prog.data.id}/tasks`, task)
      }
      setShowForm(false)
      setTasks(DEFAULT_TASKS)
      setName('My 75 Hard')
      setDurationDays(75)
      loadData()
    } finally {
      setCreating(false)
    }
  }

  async function startProgram(programId: string) {
    setStarting(programId)
    try {
      const today = new Date().toISOString().split('T')[0]
      await api.post('/user-programs', { program_id: programId, start_date: today })
      navigate('/dashboard')
    } finally {
      setStarting(null)
    }
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Programs</h1>
        <div className="flex gap-3 items-center">
          <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
            New Program
          </button>
          <button onClick={() => signOut(auth)} className="text-sm underline">Sign out</button>
        </div>
      </div>

      {showForm && (
        <div className="border rounded-lg p-5 mb-6 bg-gray-50">
          <h2 className="font-semibold mb-4">New Program</h2>

          <div className="flex gap-4 mb-5">
            <div className="flex-1">
              <label className="text-sm text-gray-600 block mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border rounded px-3 py-1.5 w-full text-sm"
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">Duration (days)</label>
              <input
                type="number"
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
                className="border rounded px-3 py-1.5 w-24 text-sm"
              />
            </div>
          </div>

          <h3 className="text-sm font-semibold text-gray-700 mb-2">Tasks</h3>
          <div className="flex flex-col gap-2 mb-4">
            {tasks.map((task, i) => (
              <div key={i} className="bg-white border rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{task.name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${task.is_required ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                    {task.is_required ? 'Required' : 'Optional'}
                  </span>
                </div>

                {(task.type === 'duration' || task.type === 'measurement') && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-gray-500">Target</label>
                      <span className="text-xs font-medium text-gray-700">{task.target_value} {task.unit}</span>
                    </div>
                    <input
                      type="range"
                      min={task.type === 'duration' ? 5 : 0.5}
                      max={task.type === 'duration' ? 120 : 10}
                      step={task.type === 'duration' ? 5 : 0.5}
                      value={task.target_value ?? 0}
                      onChange={(e) => updateTask(i, 'target_value', Number(e.target.value))}
                      className="w-full accent-blue-600"
                    />
                  </div>
                )}

                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-500">Points</label>
                    <span className="text-xs font-medium text-gray-700">{task.completion_points} pts</span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={200}
                    step={5}
                    value={task.completion_points}
                    onChange={(e) => updateTask(i, 'completion_points', Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>

                {task.bonus_points > 0 && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-gray-500">Bonus points</label>
                      <span className="text-xs font-medium text-gray-700">{task.bonus_points} pts</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={task.bonus_points}
                      onChange={(e) => updateTask(i, 'bonus_points', Number(e.target.value))}
                      className="w-full accent-blue-600"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={createProgram}
              disabled={creating || !name}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Program'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading && <p className="text-gray-500">Loading...</p>}
      {!loading && programs.length === 0 && !showForm && (
        <p className="text-gray-500">No programs yet. Create one to get started.</p>
      )}

      <div className="flex flex-col gap-4">
        {programs.map((p) => {
          const isActive = activeRunProgramIds.has(p.id)
          return (
            <div key={p.id} className="border rounded-lg p-4 flex justify-between items-center">
              <div>
                <p className="font-semibold">{p.name}</p>
                <p className="text-sm text-gray-500">{p.duration_days} days</p>
              </div>
              {isActive ? (
                <button onClick={() => navigate('/dashboard')} className="px-4 py-2 border rounded-lg text-sm">
                  View Active
                </button>
              ) : (
                <button
                  onClick={() => startProgram(p.id)}
                  disabled={starting === p.id}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {starting === p.id ? 'Starting...' : 'Start'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
