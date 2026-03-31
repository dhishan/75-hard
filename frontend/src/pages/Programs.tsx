import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '@/firebase'
import { api } from '@/api/client'
import type { Program, UserProgram } from '@/types'

export default function Programs() {
  const navigate = useNavigate()
  const [programs, setPrograms] = useState<Program[]>([])
  const [activeRunProgramIds, setActiveRunProgramIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState<string | null>(null)

  useEffect(() => {
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
  }, [])

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
        <button onClick={() => signOut(auth)} className="text-sm underline">
          Sign out
        </button>
      </div>

      {loading && <p className="text-gray-500">Loading...</p>}

      {!loading && programs.length === 0 && (
        <p className="text-gray-500">No programs available. Ask your admin to create one.</p>
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
