import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '@/firebase'
import { api } from '@/api/client'
import { toLocalISODate } from '@/utils/date'
import type { Program, ProgramWithTasks, TaskDefinition, UserProgram, TaskCategory, TaskFrequency, PenaltyMode } from '@/types'

interface TaskDraft {
  name: string
  category: TaskCategory
  type: 'boolean' | 'duration' | 'measurement' | 'count'
  is_required: boolean
  frequency: TaskFrequency
  completion_points: number
  target_value?: number
  target_direction: 'min' | 'max'
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
  target_direction: 'min',
}

const CATEGORY_COLORS: Record<string, string> = {
  health: 'bg-emerald-100 text-emerald-700',
  fitness: 'bg-blue-100 text-blue-700',
  nutrition: 'bg-orange-100 text-orange-700',
  mindset: 'bg-purple-100 text-purple-700',
  personal_development: 'bg-indigo-100 text-indigo-700',
  professional_development: 'bg-sky-100 text-sky-700',
  finance: 'bg-yellow-100 text-yellow-700',
  relationships: 'bg-pink-100 text-pink-700',
  creativity: 'bg-rose-100 text-rose-700',
  other: 'bg-gray-100 text-gray-600',
}

const DRAFT_KEY = '75hard_program_draft'

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveDraft(draft: object) {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY)
}

export default function Programs() {
  const navigate = useNavigate()
  const [programs, setPrograms] = useState<Program[]>([])
  const [activeRunProgramIds, setActiveRunProgramIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState<string | null>(null)

  const saved = loadDraft()
  const [showForm, setShowForm] = useState(saved?.showForm ?? false)
  const [step, setStep] = useState(saved?.step ?? 1)

  // Step 1
  const [name, setName] = useState(saved?.name ?? 'My Program')
  const [durationDays, setDurationDays] = useState(saved?.durationDays ?? 75)

  // Step 2
  const [tasks, setTasks] = useState<TaskDraft[]>(saved?.tasks ?? [])
  const [addingTask, setAddingTask] = useState(false)
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(BLANK_TASK)

  // Step 3
  const [penaltyMode, setPenaltyMode] = useState<PenaltyMode>(saved?.penaltyMode ?? 'exponential')
  const [pointsPerShield, setPointsPerShield] = useState(saved?.pointsPerShield ?? 1500)
  const [maxShieldsPerWeek, setMaxShieldsPerWeek] = useState(saved?.maxShieldsPerWeek ?? 1)

  const [creating, setCreating] = useState(false)

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDuration, setEditDuration] = useState(75)
  const [editTasks, setEditTasks] = useState<TaskDefinition[]>([])
  const [editLoading, setEditLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Persist wizard state to localStorage whenever it changes
  useEffect(() => {
    if (showForm) {
      saveDraft({ showForm, step, name, durationDays, tasks, penaltyMode, pointsPerShield, maxShieldsPerWeek })
    }
  }, [showForm, step, name, durationDays, tasks, penaltyMode, pointsPerShield, maxShieldsPerWeek])

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
          target_direction: task.target_direction,
          unit: task.unit,
          order: i + 1,
          bonus_points: 0,
          bonus_threshold_pct: 1.0,
          min_completion_pct: 1.0,
          sub_options: [],
        })
      }
      clearDraft()
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
      const today = toLocalISODate()
      await api.post('/user-programs', { program_id: programId, start_date: today })
      navigate('/dashboard')
    } finally {
      setStarting(null)
    }
  }

  async function openEdit(p: Program) {
    if (editingId === p.id) {
      setEditingId(null)
      return
    }
    setEditingId(p.id)
    setEditName(p.name)
    setEditDuration(p.duration_days)
    setConfirmDelete(false)
    setEditLoading(true)
    try {
      const res = await api.get<ProgramWithTasks>(`/programs/${p.id}`)
      setEditTasks(res.data.tasks)
    } finally {
      setEditLoading(false)
    }
  }

  function updateEditTask(id: string, field: 'name' | 'completion_points', value: string | number) {
    setEditTasks((prev) => prev.map((t) => t.id === id ? { ...t, [field]: value } : t))
  }

  async function saveEdit(p: Program) {
    setSaving(true)
    try {
      await api.put(`/programs/${p.id}`, {
        name: editName,
        duration_days: editDuration,
        penalty_mode: p.penalty_mode,
        points_per_shield: p.points_per_shield,
        max_shields_per_week: p.max_shields_per_week,
      })
      for (const task of editTasks) {
        await api.patch(`/programs/${p.id}/tasks/${task.id}`, {
          name: task.name,
          completion_points: task.completion_points,
        })
      }
      setEditingId(null)
      loadData()
    } finally {
      setSaving(false)
    }
  }

  async function deleteProgram(programId: string) {
    setDeleting(true)
    try {
      await api.delete(`/programs/${programId}`)
      setEditingId(null)
      setConfirmDelete(false)
      loadData()
    } finally {
      setDeleting(false)
    }
  }

  const inputClass ='border border-[#c2c6d6] rounded-lg px-3 py-2 text-[#171c1f] bg-white focus:outline-none focus:border-[#0058be] focus:ring-1 focus:ring-[#0058be] w-full text-sm'

  return (
    <div className="min-h-screen bg-[#f6fafe]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-[#171c1f]" style={{ fontFamily: 'Inter, sans-serif' }}>Programs</h1>
          <div className="flex gap-3 items-center">
            <button
              onClick={() => { setShowForm(true); setStep(1) }}
              className="bg-[#0058be] text-white rounded-full px-6 py-2.5 font-medium hover:bg-[#2170e4] text-sm transition-colors"
            >
              New Program
            </button>
            <button
              onClick={() => signOut(auth)}
              className="text-sm text-[#545f73] hover:underline"
            >
              Sign out
            </button>
          </div>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl border border-[#c2c6d6] p-6 shadow-sm mb-8">
            {/* Step Indicator */}
            <div className="flex items-center justify-center gap-0 mb-8">
              {(['Program', 'Tasks', 'Penalty'] as const).map((label, idx) => (
                <div key={label} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                      step === idx + 1
                        ? 'bg-[#0058be] text-white'
                        : step > idx + 1
                        ? 'bg-[#006947] text-white'
                        : 'border-2 border-[#c2c6d6] text-[#545f73] bg-white'
                    }`}>
                      {step > idx + 1 ? '✓' : idx + 1}
                    </span>
                    <span className={`text-xs mt-1 font-medium ${
                      step === idx + 1 ? 'text-[#0058be]' : step > idx + 1 ? 'text-[#006947]' : 'text-[#545f73]'
                    }`}>{label}</span>
                  </div>
                  {idx < 2 && (
                    <div className={`w-16 h-0.5 mb-4 mx-1 ${step > idx + 1 ? 'bg-[#006947]' : 'bg-[#c2c6d6]'}`} />
                  )}
                </div>
              ))}
            </div>

            {/* Step 1: Details */}
            {step === 1 && (
              <div>
                <h2 className="text-base font-semibold text-[#171c1f] mb-5">Program Details</h2>
                <div className="flex gap-4 mb-6">
                  <div className="flex-1">
                    <label className="text-sm text-[#545f73] block mb-1.5 font-medium">Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-[#545f73] block mb-1.5 font-medium">Duration (days)</label>
                    <input
                      type="number"
                      value={durationDays}
                      onChange={(e) => setDurationDays(Number(e.target.value))}
                      className="border border-[#c2c6d6] rounded-lg px-3 py-2 text-[#171c1f] bg-white focus:outline-none focus:border-[#0058be] focus:ring-1 focus:ring-[#0058be] w-24 text-sm"
                    />
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => { clearDraft(); setShowForm(false); setStep(1); setTasks([]); setName('My Program'); setDurationDays(75); setPenaltyMode('exponential'); setPointsPerShield(1500); setMaxShieldsPerWeek(1) }}
                    className="border border-[#0058be] text-[#0058be] rounded-full px-6 py-2.5 font-medium hover:bg-[#f0f4f8] text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setStep(2)}
                    disabled={!name}
                    className="bg-[#0058be] text-white rounded-full px-6 py-2.5 font-medium hover:bg-[#2170e4] text-sm disabled:opacity-50 transition-colors"
                  >
                    Next: Tasks →
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Tasks */}
            {step === 2 && (
              <div>
                <h2 className="text-base font-semibold text-[#171c1f] mb-1">
                  Tasks{' '}
                  <span className="text-[#6f7a8d] font-normal text-sm">({tasks.length} added)</span>
                </h2>

                {tasks.length === 0 && !addingTask && (
                  <p className="text-sm text-[#6f7a8d] mb-4 mt-2">No tasks yet. Add at least one to continue.</p>
                )}

                <div className="flex flex-col mb-3 mt-3">
                  {tasks.map((t, i) => (
                    <div key={i} className="bg-[#f0f4f8] rounded-xl p-3 mb-2 flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-[#171c1f]">{t.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[t.category] ?? 'bg-gray-100 text-gray-600'}`}>
                            {CATEGORIES.find(c => c.value === t.category)?.label}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            t.is_required ? 'bg-red-100 text-red-700' : 'bg-[#fef3c7] text-[#92400e]'
                          }`}>
                            {t.is_required ? `Required · ${t.frequency}` : `Optional · ${t.completion_points}pts`}
                          </span>
                        </div>
                        {t.target_value && (
                          <p className="text-xs text-[#6f7a8d] mt-0.5">
                            {t.target_direction === 'max' ? 'At most' : 'At least'} {t.target_value}{t.unit ? ` ${t.unit}` : ''}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => removeTask(i)}
                        className="text-[#ba1a1a] text-sm hover:underline ml-3 shrink-0 font-medium"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                {addingTask ? (
                  <div className="bg-white border border-[#c2c6d6] rounded-xl p-4 mb-4">
                    <h3 className="text-sm font-semibold text-[#171c1f] mb-4 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#0058be] text-white flex items-center justify-center text-xs">+</span>
                      New Task
                    </h3>

                    <div className="mb-3">
                      <label className="text-xs text-[#545f73] block mb-1.5 font-medium">Task name</label>
                      <input
                        type="text"
                        value={taskDraft.name}
                        onChange={(e) => updateDraft('name', e.target.value)}
                        placeholder="e.g. Morning workout"
                        className={inputClass}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="text-xs text-[#545f73] block mb-1.5 font-medium">Category</label>
                        <select
                          value={taskDraft.category}
                          onChange={(e) => updateDraft('category', e.target.value as TaskCategory)}
                          className={inputClass}
                        >
                          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-[#545f73] block mb-1.5 font-medium">Type</label>
                        <select
                          value={taskDraft.type}
                          onChange={(e) => updateDraft('type', e.target.value as TaskDraft['type'])}
                          className={inputClass}
                        >
                          <option value="boolean">Boolean (yes / no)</option>
                          <option value="duration">Duration (time-based)</option>
                          <option value="measurement">Measurement (numeric)</option>
                        </select>
                      </div>
                    </div>

                    {(taskDraft.type === 'duration' || taskDraft.type === 'measurement' || taskDraft.type === 'count') && (
                      <div className="flex gap-3 mb-3">
                        <div>
                          <label className="text-xs text-[#545f73] block mb-1.5 font-medium">Direction</label>
                          <div className="flex rounded-lg overflow-hidden border border-[#c2c6d6]">
                            {(['min', 'max'] as const).map((dir) => (
                              <button
                                key={dir}
                                type="button"
                                onClick={() => updateDraft('target_direction', dir)}
                                className={`px-3 py-2 text-xs font-medium transition-colors ${
                                  taskDraft.target_direction === dir
                                    ? 'bg-[#0058be] text-white'
                                    : 'bg-white text-[#545f73] hover:bg-[#f0f4f8]'
                                }`}
                              >
                                {dir === 'min' ? 'At least' : 'At most'}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex-1">
                          <label className="text-xs text-[#545f73] block mb-1.5 font-medium">Target value</label>
                          <input
                            type="number"
                            value={taskDraft.target_value ?? ''}
                            onChange={(e) => updateDraft('target_value', Number(e.target.value))}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-[#545f73] block mb-1.5 font-medium">Unit</label>
                          <input
                            type="text"
                            value={taskDraft.unit ?? ''}
                            onChange={(e) => updateDraft('unit', e.target.value)}
                            placeholder="min / kg / L"
                            className="border border-[#c2c6d6] rounded-lg px-3 py-2 text-[#171c1f] bg-white focus:outline-none focus:border-[#0058be] focus:ring-1 focus:ring-[#0058be] w-24 text-sm"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs text-[#545f73] font-medium">Required</span>
                      <button
                        type="button"
                        onClick={() => updateDraft('is_required', !taskDraft.is_required)}
                        className={`relative w-10 h-5 rounded-full transition-colors ${taskDraft.is_required ? 'bg-[#ba1a1a]' : 'bg-[#0058be]'}`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${taskDraft.is_required ? 'left-0.5' : 'left-5'}`} />
                      </button>
                      <span className="text-xs text-[#545f73] font-medium">Optional</span>
                    </div>

                    {taskDraft.is_required && (
                      <div className="mb-3">
                        <label className="text-xs text-[#545f73] block mb-1.5 font-medium">Frequency</label>
                        <select
                          value={taskDraft.frequency}
                          onChange={(e) => updateDraft('frequency', e.target.value as TaskFrequency)}
                          className={inputClass}
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
                        <div className="flex justify-between mb-1.5">
                          <label className="text-xs text-[#545f73] font-medium">Points for completion</label>
                          <span className="text-xs font-semibold text-[#0058be]">{taskDraft.completion_points} pts</span>
                        </div>
                        <input
                          type="range"
                          min={10}
                          max={500}
                          step={10}
                          value={taskDraft.completion_points}
                          onChange={(e) => updateDraft('completion_points', Number(e.target.value))}
                          className="w-full accent-[#0058be]"
                        />
                      </div>
                    )}

                    <div className="flex gap-2 justify-end pt-2 border-t border-[#eaeef2]">
                      <button
                        onClick={() => { setAddingTask(false); setTaskDraft(BLANK_TASK) }}
                        className="border border-[#0058be] text-[#0058be] rounded-full px-5 py-2 font-medium hover:bg-[#f0f4f8] text-sm transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={addTask}
                        disabled={!taskDraft.name.trim()}
                        className="bg-[#0058be] text-white rounded-full px-5 py-2 font-medium hover:bg-[#2170e4] text-sm disabled:opacity-50 transition-colors"
                      >
                        Add Task
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingTask(true)}
                    className="w-full border-2 border-dashed border-[#c2c6d6] rounded-xl py-3 text-sm text-[#6f7a8d] hover:border-[#0058be] hover:text-[#0058be] mb-4 transition-colors font-medium"
                  >
                    + Add Task
                  </button>
                )}

                <div className="flex justify-between pt-2">
                  <button
                    onClick={() => setStep(1)}
                    className="border border-[#0058be] text-[#0058be] rounded-full px-6 py-2.5 font-medium hover:bg-[#f0f4f8] text-sm transition-colors"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => setStep(3)}
                    disabled={tasks.length === 0}
                    className="bg-[#0058be] text-white rounded-full px-6 py-2.5 font-medium hover:bg-[#2170e4] text-sm disabled:opacity-50 transition-colors"
                  >
                    Next: Penalty →
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Penalty Config */}
            {step === 3 && (
              <div>
                <h2 className="text-base font-semibold text-[#171c1f] mb-1">Penalty Configuration</h2>
                <p className="text-sm text-[#6f7a8d] mb-5">What happens when you miss a required task?</p>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  <button
                    type="button"
                    onClick={() => setPenaltyMode('exponential')}
                    className={`rounded-xl p-4 text-left transition-colors ${
                      penaltyMode === 'exponential'
                        ? 'border-2 border-[#0058be] bg-[#f0f4f8]'
                        : 'border border-[#c2c6d6] bg-white hover:border-[#6f7a8d]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {penaltyMode === 'exponential' && (
                        <span className="w-4 h-4 rounded-full bg-[#0058be] text-white flex items-center justify-center text-xs">✓</span>
                      )}
                      <p className="font-semibold text-sm text-[#171c1f]">Exponential Days</p>
                    </div>
                    <p className="text-xs text-[#6f7a8d] mb-3">Each failure adds more days to your program</p>
                    <code className="text-xs bg-[#eaeef2] px-2 py-1 rounded font-mono text-[#171c1f]">extra = 2^(N−1)</code>
                    <div className="mt-3 text-xs text-[#6f7a8d] space-y-0.5">
                      <div>Failure 1 → +1 day</div>
                      <div>Failure 2 → +2 days</div>
                      <div>Failure 3 → +4 days</div>
                      <div>Failure 4 → +8 days</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPenaltyMode('reset')}
                    className={`rounded-xl p-4 text-left transition-colors ${
                      penaltyMode === 'reset'
                        ? 'border-2 border-[#0058be] bg-[#f0f4f8]'
                        : 'border border-[#c2c6d6] bg-white hover:border-[#6f7a8d]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {penaltyMode === 'reset' && (
                        <span className="w-4 h-4 rounded-full bg-[#0058be] text-white flex items-center justify-center text-xs">✓</span>
                      )}
                      <p className="font-semibold text-sm text-[#171c1f]">Program Reset</p>
                    </div>
                    <p className="text-xs text-[#6f7a8d] mb-3">Miss a task and start over from Day 1</p>
                    <p className="text-xs text-[#6f7a8d] mt-2">The ultimate commitment mode. One miss resets all progress back to Day 1.</p>
                    <p className="text-xs text-[#6f7a8d] mt-1">Total failures are tracked for history.</p>
                  </button>
                </div>

                <div className="bg-[#f0f4f8] rounded-xl p-4 mb-6">
                  <p className="text-sm font-semibold text-[#171c1f] mb-1">Shields</p>
                  <p className="text-xs text-[#6f7a8d] mb-4">
                    Earn points from optional tasks. Spend them to absorb one penalty.
                    Points are deducted when a shield is used.
                  </p>
                  <div className="mb-4">
                    <div className="flex justify-between mb-1.5">
                      <label className="text-xs text-[#545f73] font-medium">Points cost per shield</label>
                      <span className="text-xs font-semibold text-[#0058be]">{pointsPerShield.toLocaleString()} pts</span>
                    </div>
                    <input
                      type="range"
                      min={100}
                      max={5000}
                      step={100}
                      value={pointsPerShield}
                      onChange={(e) => setPointsPerShield(Number(e.target.value))}
                      className="w-full accent-[#0058be]"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <label className="text-xs text-[#545f73] font-medium">Max shields per week</label>
                      <span className="text-xs font-semibold text-[#0058be]">{maxShieldsPerWeek === 0 ? 'Unlimited' : maxShieldsPerWeek}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={5}
                      step={1}
                      value={maxShieldsPerWeek}
                      onChange={(e) => setMaxShieldsPerWeek(Number(e.target.value))}
                      className="w-full accent-[#0058be]"
                    />
                  </div>
                </div>

                <div className="flex justify-between">
                  <button
                    onClick={() => setStep(2)}
                    className="border border-[#0058be] text-[#0058be] rounded-full px-6 py-2.5 font-medium hover:bg-[#f0f4f8] text-sm transition-colors"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={createProgram}
                    disabled={creating}
                    className="bg-[#0058be] text-white rounded-full px-6 py-2.5 font-medium hover:bg-[#2170e4] text-sm disabled:opacity-50 transition-colors"
                  >
                    {creating ? 'Creating...' : 'Create Program'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {loading && <p className="text-[#6f7a8d] text-sm">Loading...</p>}
        {!loading && programs.length === 0 && !showForm && (
          <p className="text-[#6f7a8d] text-sm">No programs yet. Create one to get started.</p>
        )}

        <div className="flex flex-col gap-4">
          {programs.map((p) => {
            const isActive = activeRunProgramIds.has(p.id)
            const isEditing = editingId === p.id
            return (
              <div key={p.id}>
                <div className={`bg-white rounded-xl border p-5 flex justify-between items-center shadow-sm ${isEditing ? 'border-[#0058be]' : 'border-[#c2c6d6]'}`}>
                  <div>
                    <p className="font-semibold text-[#171c1f]">{p.name}</p>
                    <p className="text-sm text-[#6f7a8d] mt-0.5">
                      {p.duration_days} days · {p.penalty_mode === 'reset' ? 'Resets on miss' : 'Exponential days'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(p)}
                      className={`border rounded-full px-4 py-2 font-medium text-sm transition-colors ${isEditing ? 'border-[#0058be] bg-[#0058be] text-white' : 'border-[#c2c6d6] text-[#545f73] hover:border-[#6f7a8d]'}`}
                    >
                      {isEditing ? 'Editing' : 'Edit'}
                    </button>
                    {isActive ? (
                      <button
                        onClick={() => navigate('/dashboard')}
                        className="border border-[#0058be] text-[#0058be] rounded-full px-5 py-2 font-medium hover:bg-[#f0f4f8] text-sm transition-colors"
                      >
                        View Active
                      </button>
                    ) : (
                      <button
                        onClick={() => startProgram(p.id)}
                        disabled={starting === p.id}
                        className="bg-[#0058be] text-white rounded-full px-5 py-2 font-medium hover:bg-[#2170e4] text-sm disabled:opacity-50 transition-colors"
                      >
                        {starting === p.id ? 'Starting...' : 'Start'}
                      </button>
                    )}
                  </div>
                </div>

                {isEditing && (
                  <div className="bg-white rounded-xl border border-[#0058be] p-5 mt-1 shadow-sm">
                    {editLoading ? (
                      <p className="text-sm text-[#6f7a8d]">Loading...</p>
                    ) : (
                      <>
                        {isActive && (
                          <div className="bg-[#fff8e6] border border-[#f0c040] rounded-lg px-3 py-2 text-xs text-[#7a5800] mb-4">
                            This program has an active run. Changes apply to future runs only.
                          </div>
                        )}

                        <div className="flex gap-4 mb-5">
                          <div className="flex-1">
                            <label className="text-xs text-[#545f73] block mb-1.5 font-medium">Name</label>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-[#545f73] block mb-1.5 font-medium">Duration (days)</label>
                            <input
                              type="number"
                              value={editDuration}
                              onChange={(e) => setEditDuration(Number(e.target.value))}
                              className="border border-[#c2c6d6] rounded-lg px-3 py-2 text-[#171c1f] bg-white focus:outline-none focus:border-[#0058be] focus:ring-1 focus:ring-[#0058be] w-24 text-sm"
                            />
                          </div>
                        </div>

                        {editTasks.length > 0 && (
                          <div className="mb-5">
                            <p className="text-xs text-[#545f73] font-medium mb-2">Tasks</p>
                            <div className="flex flex-col gap-2">
                              {editTasks.map((task) => (
                                <div key={task.id} className="bg-[#f0f4f8] rounded-lg p-3">
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[task.category] ?? 'bg-gray-100 text-gray-600'}`}>
                                      {CATEGORIES.find((c) => c.value === task.category)?.label}
                                    </span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${task.is_required ? 'bg-red-100 text-red-700' : 'bg-[#fef3c7] text-[#92400e]'}`}>
                                      {task.is_required ? 'Required' : 'Optional'}
                                    </span>
                                  </div>
                                  <input
                                    type="text"
                                    value={task.name}
                                    onChange={(e) => updateEditTask(task.id, 'name', e.target.value)}
                                    className={inputClass}
                                  />
                                  {!task.is_required && (
                                    <div className="mt-2">
                                      <div className="flex justify-between mb-1">
                                        <label className="text-xs text-[#545f73] font-medium">Points</label>
                                        <span className="text-xs font-semibold text-[#0058be]">{task.completion_points} pts</span>
                                      </div>
                                      <input
                                        type="range"
                                        min={10}
                                        max={500}
                                        step={10}
                                        value={task.completion_points}
                                        onChange={(e) => updateEditTask(task.id, 'completion_points', Number(e.target.value))}
                                        className="w-full accent-[#0058be]"
                                      />
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between items-center pt-3 border-t border-[#eaeef2]">
                          {confirmDelete ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-[#ba1a1a] font-medium">Delete this program?</span>
                              <button
                                onClick={() => deleteProgram(p.id)}
                                disabled={deleting}
                                className="bg-[#ba1a1a] text-white rounded-full px-4 py-1.5 text-xs font-medium disabled:opacity-50"
                              >
                                {deleting ? 'Deleting...' : 'Confirm'}
                              </button>
                              <button
                                onClick={() => setConfirmDelete(false)}
                                className="text-xs text-[#545f73] hover:underline"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDelete(true)}
                              className="text-xs text-[#ba1a1a] font-medium hover:underline"
                            >
                              Delete program
                            </button>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingId(null)}
                              className="border border-[#0058be] text-[#0058be] rounded-full px-5 py-2 font-medium hover:bg-[#f0f4f8] text-sm transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => saveEdit(p)}
                              disabled={saving || !editName.trim()}
                              className="bg-[#0058be] text-white rounded-full px-5 py-2 font-medium hover:bg-[#2170e4] text-sm disabled:opacity-50 transition-colors"
                            >
                              {saving ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
