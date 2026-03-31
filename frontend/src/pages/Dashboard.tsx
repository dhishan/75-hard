import { useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '@/firebase'
import { useAuthStore } from '@/store/auth'
import { useProgramStore } from '@/store/program'
import { api } from '@/api/client'
import type { UserProgram } from '@/types'
import DayCounter from '@/components/DayCounter'
import ShieldStatus from '@/components/ShieldStatus'

export default function Dashboard() {
  const { user: _user } = useAuthStore()
  const { activeRun, setActiveRun } = useProgramStore()
  const navigate = useNavigate()

  useEffect(() => {
    api.get<UserProgram[]>('/user-programs').then((res) => {
      const active = res.data.find((r) => r.status === 'active')
      if (active) setActiveRun(active)
    })
  }, [])

  if (!activeRun) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
        <p className="text-gray-500">
          No active program.{' '}
          <Link to="/programs" className="underline">
            Start one
          </Link>
          .
        </p>
        <button onClick={() => signOut(auth)} className="mt-4 text-sm underline block">
          Sign out
        </button>
      </div>
    )
  }

  const snapshot = activeRun.program_snapshot as Record<string, unknown>
  const programName = (snapshot?.name as string) ?? 'My Challenge'
  const pointsPerShield = (snapshot?.points_per_shield as number) ?? 1500
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{programName}</h1>
        <div className="flex gap-3">
          <button onClick={() => navigate('/graphs')} className="text-sm underline">
            Graphs
          </button>
          <button onClick={() => signOut(auth)} className="text-sm underline">
            Sign out
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <DayCounter
          currentDay={activeRun.current_day}
          totalDaysRequired={activeRun.total_days_required}
        />
        <ShieldStatus
          tokensAvailable={activeRun.shield_tokens_available}
          totalPointsEarned={activeRun.total_points_earned}
          pointsPerShield={pointsPerShield}
          shieldsUsed={activeRun.shields_used}
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => navigate(`/log/${today}`)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg"
        >
          Log Today
        </button>
        <button
          onClick={() => navigate('/graphs')}
          className="px-4 py-2 border rounded-lg"
        >
          Graphs
        </button>
      </div>
    </div>
  )
}
