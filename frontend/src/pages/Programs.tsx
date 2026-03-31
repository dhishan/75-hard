import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '@/firebase'
import { api } from '@/api/client'
import type { Program, UserProgram, TaskCategory, TaskFrequency, PenaltyMode } from '@/types'

interface TaskDraft {
  name: string
  category: TaskCategory
  type: 'boolean' | 'duration' | 'measurement'
  is_required: boolean
  frequency: TaskFrequency
  completion_points: number
  target_value?: number
  unit?: string
}

const CATEGORIES: { value: TaskCategory; label: string }[] = [
  { value: 'health', label: 'Health' },
  { value: 'fitness', label: 'Fitness' },
  { value: 'nutrition', label: 'Nutrition' },
  { value: 'mindset', label: 'Mindset' },
  { value: 'personal_development', label: 'Personal Development' },
  { value: 'professional_development', label: 'Professional Development' },
  { value: 'finance', label: 'Finance' },
  { value: 'relationships', label: 'Relationships' },
  { value: 'creativity', label: 'Creativity' },
  { value: 'other', label: 'Other' },
]

const BLANK_TASK: TaskDraft = {
  name: '',
  category: 'health',
  type: 'boolean',
  is_required: true,
  frequency: 'daily',
  completion_points: 0,
}

export default function Programs() {
  const navigate = useNavigate()
  const [programs, setPrograms] = useState<Program[]>([])
  const [activeRunProgramIds, setActiveRunProgramIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [step, setStep] = useState(1)

  // Step 1
  const [name, setName] = useState('My Program')
  const [durationDays, setDurationDays] = useState(75)

  // Step 2
  const [tasks, setTasks] = useState<TaskDraft[]>([])
  const [addingTask, setAddingTask] = useState(false)
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(BLANK_TASK)

  // Step 3
  const [penaltyMode, setPenaltyMode] = useState<PenaltyMode>('exponential')
  const [pointsPerShield, setPointsPerShield] = useState(1500)
  const [maxShieldsPerWeek, setMaxShieldsPerWeek] = useState(1)

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

  function addTask() {
    if (!taskDraft.name.trim()) return
    setTasks((prev) => [...prev, { ...taskDraft }])
    setTaskDraft(BLANK_TASK)
    setAddingTask(false)
  }

  function removeTask(i: number) {
    setTasks((prev) => prev.filter((_, idx) => idx !== i))
  }

  function updateDraft<K extends keyof TaskDraft>(field: K, value: TaskDraft[K]) {
    setTaskDraft((prev) => {
      const updated = { ...prev, [field]: value }
      if (field === 'is_required') {
        if (value) {
          updated.completion_points = 0
          updated.frequency = 'daily'
        }
      }
      return updated
    })
  }

  async function createProgram() {
    setCreating(true)
    try {
      const prog = await api.post<Program>('/programs', {
        name,
        duration_days: durationDays,
        penalty_mode: penaltyMode,
        points_per_shield: pointsPerShield,
        max_shields_per_week: maxShieldsPerWeek,
      })
      for (const [i, task] of tasks.entries()) {
        await api.post(`/programs/${prog.data.id}/tasks`, {
          name: task.name,
          category: task.category,
          type: task.type,
          is_required: task.is_required,
          frequency: task.is_required ? task.frequency : 'daily',
          completion_points: task.is_required ? 0 : task.completion_points,
          target_value: task.target_value,
          unit: task.unit,
          order: i + 1,
          bonus_points: 0,
          bonus_threshold_pct: 1.0,
          min_completion_pct: 1.0,
          sub_options: [],
        })
      }
      setShowForm(false)
      setStep(1)
      setTasks([])
      setName('My Program')
      setDurationDays(75)
      setPenaltyMode('exponential')
      setPointsPerShield(1500)
      setMaxShieldsPerWeek(1)
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
          <button
            onClick={() => { setShowForm(true); setStep(1) }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
          >
            New Program
          </button>
          <button onClick={() => signOut(auth)} className="text-sm underline">Sign out</button>
        </div>
      </div>

      {showForm && (
        <div className="border rounded-lg p-5 mb-6 bg-gray-50">
          {/* Stepper */}
          <div className="flex items-center gap-2 mb-5 text-sm">
            {['Details', 'Tasks', 'Penalties'].map((label, idx) => (
              <div key={label} className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === idx + 1 ? 'bg-blue-600 text-white'
                  : step > idx + 1 ? 'bg-green-500 text-white'
                  : 'bg-gray-200 text-gray-500'
                }`}>
                  {step > idx + 1 ? '✓' : idx + 1}
                </span>
                <span className={step === idx + 1 ? 'font-semibold text-gray-800' : 'text-gray-400'}>{label}</span>
                {idx < 2 && <span className="text-gray-300">→</span>}
              </div>
            ))}
          </div>

          {/* Step 1: Details */}
          {step === 1 && (
            <div>
              <h2 className="font-semibold mb-4">Program Details</h2>
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
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
                <button
                  onClick={() => setStep(2)}
                  disabled={!name}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  Next: Tasks →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Tasks */}
          {step === 2 && (
            <div>
              <h2 className="font-semibold mb-4">
                Tasks <span className="text-gray-400 font-normal text-sm">({tasks.length} added)</span>
              </h2>

              {tasks.length === 0 && !addingTask && (
                <p className="text-sm text-gray-400 mb-4">No tasks yet. Add at least one to continue.</p>
              )}

              <div className="flex flex-col gap-2 mb-3">
                {tasks.map((t, i) => (
                  <div key={i} className="bg-white border rounded-lg px-3 py-2 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">{t.name}</span>
                      <span className="text-xs text-gray-400 ml-2">
                        {CATEGORIES.find(c => c.value === t.category)?.label} · {t.type}
                        {t.target_value ? ` · ${t.target_value}${t.unit ? ` ${t.unit}` : ''}` : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        t.is_required ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {t.is_required
                          ? `Required · ${t.frequency}`
                          : `Optional · ${t.completion_points}pts`}
                      </span>
                      <button onClick={() => removeTask(i)} className="text-gray-300 hover:text-red-400 text-xs ml-1">✕</button>
                    </div>
                  </div>
                ))}
              </div>

              {addingTask ? (
                <div className="bg-white border rounded-lg p-4 mb-3">
                  <h3 className="text-sm font-semibold mb-3">New Task</h3>

                  <div className="mb-3">
                    <label className="text-xs text-gray-500 block mb-1">Task name</label>
                    <input
                      type="text"
                      value={taskDraft.name}
                      onChange={(e) => updateDraft('name', e.target.value)}
                      placeholder="e.g. Morning workout"
                      className="border rounded px-3 py-1.5 w-full text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Category</label>
                      <select
                        value={taskDraft.category}
                        onChange={(e) => updateDraft('category', e.target.value as TaskCategory)}
                        className="border rounded px-3 py-1.5 w-full text-sm"
                      >
                        {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Type</label>
                      <select
                        value={taskDraft.type}
                        onChange={(e) => updateDraft('type', e.target.value as TaskDraft['type'])}
                        className="border rounded px-3 py-1.5 w-full text-sm"
                      >
                        <option value="boolean">Boolean (yes / no)</option>
                        <option value="duration">Duration (time-based)</option>
                        <option value="measurement">Measurement (numeric)</option>
                      </select>
                    </div>
                  </div>

                  {(taskDraft.type === 'duration' || taskDraft.type === 'measurement') && (
                    <div className="flex gap-3 mb-3">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 block mb-1">Target value</label>
                        <input
                          type="number"
                          value={taskDraft.target_value ?? ''}
                          onChange={(e) => updateDraft('target_value', Number(e.target.value))}
                          className="border rounded px-3 py-1.5 w-full text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Unit</label>
                        <input
                          type="text"
                          value={taskDraft.unit ?? ''}
                          onChange={(e) => updateDraft('unit', e.target.value)}
                          placeholder="min / kg / L"
                          className="border rounded px-3 py-1.5 w-24 text-sm"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs text-gray-500">Required</span>
                    <button
                      type="button"
                      onClick={() => updateDraft('is_required', !taskDraft.is_required)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${taskDraft.is_required ? 'bg-red-400' : 'bg-blue-500'}`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${taskDraft.is_required ? 'left-0.5' : 'left-5'}`} />
                    </button>
                    <span className="text-xs text-gray-500">Optional</span>
                  </div>

                  {taskDraft.is_required && (
                    <div className="mb-3">
                      <label className="text-xs text-gray-500 block mb-1">Frequency</label>
                      <select
                        value={taskDraft.frequency}
                        onChange={(e) => updateDraft('frequency', e.target.value as TaskFrequency)}
                        className="border rounded px-3 py-1.5 w-full text-sm"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly (at least once per week)</option>
                        <option value="monthly">Monthly (at least once per month)</option>
                        <option value="period">Once per program</option>
                      </select>
                    </div>
                  )}

                  {!taskDraft.is_required && (
                    <div className="mb-3">
                      <div className="flex justify-between mb-1">
                        <label className="text-xs text-gray-500">Points for completion</label>
                        <span className="text-xs font-medium text-gray-700">{taskDraft.completion_points} pts</span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={500}
                        step={10}
                        value={taskDraft.completion_points}
                        onChange={(e) => updateDraft('completion_points', Number(e.target.value))}
                        className="w-full accent-blue-600"
                      />
                    </div>
                  )}

                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => { setAddingTask(false); setTaskDraft(BLANK_TASK) }}
                      className="px-3 py-1.5 border rounded text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={addTask}
                      disabled={!taskDraft.name.trim()}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm disabled:opacity-50"
                    >
                      Add Task
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setAddingTask(true)}
                  className="w-full border-2 border-dashed border-gray-300 rounded-lg py-2 text-sm text-gray-400 hover:border-blue-400 hover:text-blue-500 mb-3"
                >
                  + Add Task
                </button>
              )}

              <div className="flex justify-between">
                <button onClick={() => setStep(1)} className="px-4 py-2 border rounded-lg text-sm">← Back</button>
                <button
                  onClick={() => setStep(3)}
                  disabled={tasks.length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  Next: Penalties →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Penalty Config */}
          {step === 3 && (
            <div>
              <h2 className="font-semibold mb-1">Penalty Configuration</h2>
              <p className="text-sm text-gray-500 mb-4">What happens when you miss a required task?</p>

              <div className="grid grid-cols-2 gap-3 mb-5">
                <button
                  type="button"
                  onClick={() => setPenaltyMode('exponential')}
                  className={`border-2 rounded-lg p-4 text-left transition-colors ${penaltyMode === 'exponential' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <p className="font-semibold text-sm mb-1">Exponential Days</p>
                  <p className="text-xs text-gray-500 mb-2">Each failure adds more days to your program</p>
                  <code className="text-xs bg-gray-100 px-2 py-0.5 rounded">extra = 2^(N−1)</code>
                  <div className="mt-2 text-xs text-gray-400 space-y-0.5">
                    <div>Failure 1 → +1 day</div>
                    <div>Failure 2 → +2 days</div>
                    <div>Failure 3 → +4 days</div>
                    <div>Failure 4 → +8 days</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPenaltyMode('reset')}
                  className={`border-2 rounded-lg p-4 text-left transition-colors ${penaltyMode === 'reset' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <p className="font-semibold text-sm mb-1">Program Reset</p>
                  <p className="text-xs text-gray-500 mb-2">Miss a task and start over from Day 1</p>
                  <p className="text-xs text-gray-400 mt-4">The ultimate commitment mode. One miss resets all progress back to Day 1.</p>
                  <p className="text-xs text-gray-400 mt-1">Total failures are tracked for history.</p>
                </button>
              </div>

              <div className="bg-white border rounded-lg p-4 mb-5">
                <p className="text-sm font-semibold mb-1">Shields</p>
                <p className="text-xs text-gray-500 mb-3">
                  Earn points from optional tasks. Spend them to absorb one penalty.
                  Points are deducted when a shield is used.
                </p>
                <div className="mb-4">
                  <div className="flex justify-between mb-1">
                    <label className="text-xs text-gray-500">Points cost per shield</label>
                    <span className="text-xs font-medium text-gray-700">{pointsPerShield.toLocaleString()} pts</span>
                  </div>
                  <input
                    type="range"
                    min={100}
                    max={5000}
                    step={100}
                    value={pointsPerShield}
                    onChange={(e) => setPointsPerShield(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs text-gray-500">Max shields per week</label>
                    <span className="text-xs font-medium text-gray-700">{maxShieldsPerWeek === 0 ? 'Unlimited' : maxShieldsPerWeek}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={5}
                    step={1}
                    value={maxShieldsPerWeek}
                    onChange={(e) => setMaxShieldsPerWeek(Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>
              </div>

              <div className="flex justify-between">
                <button onClick={() => setStep(2)} className="px-4 py-2 border rounded-lg text-sm">← Back</button>
                <button
                  onClick={createProgram}
                  disabled={creating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Program'}
                </button>
              </div>
            </div>
          )}
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
                <p className="text-sm text-gray-500">
                  {p.duration_days} days · {p.penalty_mode === 'reset' ? 'Resets on miss' : 'Exponential days'}
                </p>
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
