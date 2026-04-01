import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '@/firebase'
import { useAuthStore } from '@/store/auth'
import { useProgramStore } from '@/store/program'
import { api } from '@/api/client'
import type { DailyLog, UserProgram } from '@/types'
import DayCounter from '@/components/DayCounter'
import ShieldStatus from '@/components/ShieldStatus'

export default function Dashboard() {
  const { user: _user } = useAuthStore()
  const { activeRun, setActiveRun } = useProgramStore()
  const navigate = useNavigate()
  const [recentLogs, setRecentLogs] = useState<Record<string, DailyLog>>({})
  const [jumpDate, setJumpDate] = useState('')
  const [categoryRates, setCategoryRates] = useState<Record<string, number>>({})
  const [editingStartDate, setEditingStartDate] = useState(false)
  const [startDateInput, setStartDateInput] = useState('')
  const [startDateSaving, setStartDateSaving] = useState(false)
  const [summary, setSummary] = useState<{ complete_days: number; total_logged: number } | null>(null)

  useEffect(() => {
    api.get<UserProgram[]>('/user-programs').then((res) => {
      const active = res.data.find((r) => r.status === 'active')
      if (active) {
        setActiveRun(active)
        api.get<DailyLog[]>(`/user-programs/${active.id}/logs`).then((lr) => {
          const map: Record<string, DailyLog> = {}
          lr.data.forEach((l) => { map[l.date] = l })
          setRecentLogs(map)
        })
        api.get<{ complete_days: number; total_logged: number }>(`/user-programs/${active.id}/summary`).then((sr) => {
          setSummary(sr.data)
        })
        api.get<{ task_id: string; name: string; completion_rate: number; completed: number; total: number }[]>(
          `/user-programs/${active.id}/stats/task-rates`
        ).then((tr) => {
          const snapshot = active.program_snapshot as Record<string, unknown>
          const tasks = (snapshot?.tasks ?? []) as { id: string; category: string }[]
          const catMap: Record<string, string> = {}
          tasks.forEach((t) => { catMap[t.id] = t.category })
          const totals: Record<string, { completed: number; total: number }> = {}
          tr.data.forEach(({ task_id, completed, total }) => {
            const cat = catMap[task_id] ?? 'other'
            if (!totals[cat]) totals[cat] = { completed: 0, total: 0 }
            totals[cat].completed += completed
            totals[cat].total += total
          })
          const rates: Record<string, number> = {}
          Object.entries(totals).forEach(([cat, { completed, total }]) => {
            rates[cat] = total > 0 ? Math.round((completed / total) * 100) : 0
          })
          setCategoryRates(rates)
        })
      }
    })
  }, [])

  if (!activeRun) {
    return (
      <div className="min-h-screen bg-[#f6fafe] flex items-center justify-center">
        <div className="bg-white border border-[#c2c6d6] rounded-xl p-10 max-w-sm w-full mx-4 text-center shadow-sm">
          <span className="material-symbols-outlined text-[#0058be] text-5xl mb-4 block">flag</span>
          <h2 className="text-xl font-bold text-[#171c1f] mb-2">No Active Program</h2>
          <p className="text-[#545f73] text-sm mb-6">
            You haven't started a challenge yet.{' '}
            <Link to="/programs" className="text-[#0058be] hover:underline font-medium">
              Start one
            </Link>{' '}
            to begin tracking.
          </p>
          <button
            onClick={() => signOut(auth)}
            className="text-sm text-[#6f7a8d] hover:text-[#171c1f] transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  const CATEGORY_ICONS: Record<string, string> = {
    fitness: 'fitness_center',
    nutrition: 'restaurant',
    mindset: 'self_improvement',
    personal_development: 'menu_book',
    health: 'favorite',
    finance: 'savings',
  }

  function toTitleCase(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }

  const snapshot = activeRun.program_snapshot as Record<string, unknown>
  const programName = (snapshot?.name as string) ?? 'My Challenge'
  const pointsPerShield = (snapshot?.points_per_shield as number) ?? 1500
  const today = new Date().toISOString().split('T')[0]
  const completionPct = summary && summary.total_logged > 0
    ? Math.round((summary.complete_days / summary.total_logged) * 100)
    : null

  const snapshotTasks = ((snapshot?.tasks ?? []) as { id: string; category: string }[])
  const uniqueCategories = Array.from(new Set(snapshotTasks.map((t) => t.category)))

  async function saveStartDate() {
    if (!startDateInput || !activeRun) return
    setStartDateSaving(true)
    try {
      const res = await api.patch<UserProgram>(`/user-programs/${activeRun.id}/start-date`, { start_date: startDateInput })
      setActiveRun(res.data)
      setEditingStartDate(false)
    } finally {
      setStartDateSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f6fafe]">
      {/* Top bar */}
      <header className="bg-white border-b border-[#e4e9ed] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="font-bold text-[#171c1f] truncate max-w-[180px]">{programName}</h1>
          <div className="flex items-center gap-4 text-sm">
            <button
              onClick={() => navigate('/graphs')}
              className="text-[#0058be] hover:underline font-medium flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-base">bar_chart</span>
              Graphs
            </button>
            <button
              onClick={() => signOut(auth)}
              className="text-[#545f73] hover:text-[#171c1f] transition-colors flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-base">logout</span>
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Stats row */}
        <div className="grid grid-cols-2 gap-4">
          <DayCounter
            currentDay={activeRun.current_day}
            totalDaysRequired={activeRun.total_days_required}
          />
          {/* Completion rate card */}
          <div className="bg-white border border-[#c2c6d6] rounded-xl p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#545f73] mb-2">Completion</p>
            <p className="text-4xl font-bold text-[#171c1f] leading-none">
              {completionPct !== null ? `${completionPct}%` : '—'}
            </p>
            <p className="text-xs text-[#6f7a8d] mt-1.5">Overall rate</p>
          </div>
        </div>

        {/* Start date */}
        <div className="bg-white border border-[#c2c6d6] rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#545f73]">Start Date</p>
              <p className="text-sm font-medium text-[#171c1f] mt-0.5">{activeRun.start_date as unknown as string}</p>
            </div>
            {!editingStartDate ? (
              <button
                onClick={() => { setStartDateInput(activeRun.start_date as unknown as string); setEditingStartDate(true) }}
                className="flex items-center gap-1 text-xs text-[#0058be] font-medium hover:underline"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
                Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDateInput}
                  max={today}
                  onChange={(e) => setStartDateInput(e.target.value)}
                  className="border border-[#c2c6d6] rounded-lg px-2 py-1 text-xs text-[#171c1f] focus:outline-none focus:border-[#0058be]"
                />
                <button
                  onClick={saveStartDate}
                  disabled={startDateSaving || !startDateInput}
                  className="px-3 py-1 bg-[#0058be] text-white text-xs font-medium rounded-lg disabled:opacity-40"
                >
                  {startDateSaving ? '…' : 'Save'}
                </button>
                <button
                  onClick={() => setEditingStartDate(false)}
                  className="text-xs text-[#6f7a8d] hover:text-[#171c1f]"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Shields */}
        <ShieldStatus
          tokensAvailable={activeRun.shield_tokens_available}
          totalPointsEarned={activeRun.total_points_earned}
          pointsPerShield={pointsPerShield}
          shieldsUsed={activeRun.shields_used}
        />

        {/* Category performance cards */}
        <div className="grid grid-cols-2 gap-4">
          {uniqueCategories.map((key) => {
            const icon = CATEGORY_ICONS[key] ?? 'category'
            const label = toTitleCase(key)
            const pct = categoryRates[key] ?? null
            return (
            <div key={key} className="bg-white border border-[#c2c6d6] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-[#0058be] text-lg">{icon}</span>
                <span className="text-xs font-semibold text-[#545f73] uppercase tracking-wide">{label}</span>
              </div>
              <p className="text-2xl font-bold text-[#171c1f]">{pct !== null ? `${pct}%` : '—'}</p>
              <div className="mt-2 h-1.5 rounded-full bg-[#eaeef2] overflow-hidden">
                <div
                  className="h-full bg-[#0058be] rounded-full"
                  style={{ width: `${pct ?? 0}%` }}
                />
              </div>
            </div>
            )
          })}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={() => navigate(`/log/${today}`)}
            className="flex-1 py-3 bg-[#0058be] hover:bg-[#2170e4] text-white font-semibold rounded-full transition-colors shadow-sm shadow-blue-100 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">edit_note</span>
            Log Today
          </button>
          <button
            onClick={() => navigate('/graphs')}
            className="flex-1 py-3 border-2 border-[#0058be] text-[#0058be] font-semibold rounded-full hover:bg-[#f0f4f8] transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">insights</span>
            View Insights
          </button>
        </div>

        {/* Past days strip */}
        <div className="bg-white border border-[#c2c6d6] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#545f73]">Recent Days</p>
          </div>
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            {Array.from({ length: 14 }, (_, i) => {
              const d = new Date()
              d.setDate(d.getDate() - (13 - i))
              const dateStr = d.toISOString().split('T')[0]
              const dayName = d.toLocaleDateString('en-US', { weekday: 'short' })
              const dayNum = d.getDate()
              const isToday = dateStr === today
              const log = recentLogs[dateStr]
              const isComplete = log?.is_complete === true
              const isLogged = !!log
              const isFuture = dateStr > today

              let bg = 'bg-[#f0f4f8] text-[#6f7a8d]'
              if (isToday) bg = 'bg-[#0058be] text-white'
              else if (isComplete) bg = 'bg-[#006947] text-white'
              else if (isLogged) bg = 'bg-[#fef2f2] text-[#b91c1c] border border-[#fca5a5]'
              else if (isFuture) bg = 'bg-[#f0f4f8] text-[#c2c6d6]'

              return (
                <button
                  key={dateStr}
                  onClick={() => !isFuture && navigate(`/log/${dateStr}`)}
                  disabled={isFuture}
                  className={`flex-shrink-0 flex flex-col items-center gap-0.5 rounded-xl px-3 py-2.5 min-w-[52px] transition-all ${bg} ${isFuture ? 'opacity-40 cursor-default' : 'hover:opacity-90 cursor-pointer'}`}
                >
                  <span className="text-[10px] font-medium opacity-75">{dayName}</span>
                  <span className="text-base font-bold leading-tight">{dayNum}</span>
                  {isLogged && (
                    <span className="material-symbols-outlined text-[12px] mt-0.5">
                      {isComplete ? 'check_circle' : 'cancel'}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Jump to date */}
        <div className="bg-white border border-[#c2c6d6] rounded-xl p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#545f73] mb-3">Log a Past Day</p>
          <div className="flex gap-2">
            <input
              type="date"
              value={jumpDate}
              min={activeRun.start_date as unknown as string}
              max={today}
              onChange={(e) => setJumpDate(e.target.value)}
              className="flex-1 border border-[#c2c6d6] rounded-lg px-3 py-2 text-sm text-[#171c1f] bg-white focus:outline-none focus:border-[#0058be] focus:ring-1 focus:ring-[#0058be]"
            />
            <button
              onClick={() => jumpDate && navigate(`/log/${jumpDate}`)}
              disabled={!jumpDate}
              className="px-4 py-2 bg-[#0058be] text-white text-sm font-medium rounded-lg disabled:opacity-40 hover:bg-[#2170e4] transition-colors"
            >
              Go
            </button>
          </div>
        </div>
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e4e9ed]">
        <div className="max-w-2xl mx-auto flex items-center justify-around h-14">
          {[
            { icon: 'home', label: 'Home', active: true, onClick: () => {} },
            { icon: 'task_alt', label: 'Tasks', active: false, onClick: () => navigate(`/log/${today}`) },
            { icon: 'insights', label: 'Insights', active: false, onClick: () => navigate('/graphs') },
            { icon: 'person', label: 'Profile', active: false, onClick: () => navigate('/profile') },
          ].map(({ icon, label, active, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className={`flex flex-col items-center gap-0.5 text-xs font-medium transition-colors ${
                active ? 'text-[#0058be]' : 'text-[#6f7a8d] hover:text-[#0058be]'
              }`}
            >
              <span className="material-symbols-outlined text-xl">{icon}</span>
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* Spacer for bottom nav */}
      <div className="h-14" />
    </div>
  )
}
