import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '@/firebase'
import { api } from '@/api/client'
import type { Program, UserProgram } from '@/types'

const DEFAULT_TASKS = [
  { name: 'No added sugar', category: 'nutrition', type: 'boolean', is_required: true, completion_points: 100, bonus_points: 0, order: 1 },
  { name: 'Workout', category: 'fitness', type: 'duration', target_value: 20, unit: 'min', is_required: true, completion_points: 100, bonus_points: 50, bonus_threshold_pct: 1.5, min_completion_pct: 1.0, order: 2 },
  { name: 'Water', category: 'health', type: 'measurement', target_value: 3, unit: 'ltr', is_required: true, completion_points: 50, bonus_points: 0, min_completion_pct: 1.0, order: 3 },
  { name: 'Study session', category: 'mindset', type: 'duration', target_value: 20, unit: 'min', is_required: true, completion_points: 75, bonus_points: 0, min_completion_pct: 1.0, order: 4 },
  { name: 'Weight', category: 'health', type: 'measurement', unit: 'kg', is_required: false, completion_points: 10, bonus_points: 0, order: 5 },
  { name: 'News/Finance/Podcast', category: 'mindset', type: 'boolean', is_required: false, completion_points: 20, bonus_points: 0, sub_options: ['news', 'finance', 'podcast'], order: 6 },
  { name: 'Skin care', category: 'health', type: 'boolean', is_required: false, completion_points: 15, bonus_points: 0, order: 7 },
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
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

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

  async function createProgram() {
    setCreating(true)
    try {
      const prog = await api.post<Program>('/programs', {
        name,
        duration_days: durationDays,
        points_per_shield: 1500,
        max_shields_per_week: 1,
      })
      for (const task of DEFAULT_TASKS) {
        await api.post(`/programs/${prog.data.id}/tasks`, task)
      }
      setShowForm(false)
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
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
          >
            New Program
          </button>
          <button onClick={() => signOut(auth)} className="text-sm underline">
            Sign out
          </button>
        </div>
      </div>

      {showForm && (
        <div className="border rounded-lg p-4 mb-6 bg-gray-50">
          <h2 className="font-semibold mb-3">Create Program</h2>
          <div className="flex flex-col gap-3">
            <div>
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
            <p className="text-xs text-gray-500">Default tasks will be added: No added sugar, Workout, Water, Study session, Weight, News/Finance/Podcast, Skin care.</p>
            <div className="flex gap-2">
              <button
                onClick={createProgram}
                disabled={creating || !name}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
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
                <button
                  onClick={() => navigate('/dashboard')}
                  className="px-4 py-2 border rounded-lg text-sm"
                >
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
