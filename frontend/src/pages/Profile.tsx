import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '@/firebase'
import { useAuthStore } from '@/store/auth'
import { useProgramStore } from '@/store/program'

export default function Profile() {
  const { user } = useAuthStore()
  const { activeRun } = useProgramStore()
  const navigate = useNavigate()

  const today = new Date().toISOString().split('T')[0]
  const snapshot = activeRun?.program_snapshot as Record<string, unknown> | undefined
  const programName = (snapshot?.name as string) ?? null

  async function handleSignOut() {
    await signOut(auth)
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-[#f6fafe]">
      {/* Header */}
      <header className="bg-white border-b border-[#e4e9ed] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center">
          <h1 className="font-bold text-[#171c1f]">Profile</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4 pb-24">
        {/* Avatar + name */}
        <div className="bg-white border border-[#c2c6d6] rounded-xl p-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[#0058be] flex items-center justify-center flex-shrink-0">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="avatar" className="w-14 h-14 rounded-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-white text-2xl">person</span>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[#171c1f] truncate">{user?.displayName ?? 'No name set'}</p>
            <p className="text-sm text-[#545f73] truncate">{user?.email}</p>
          </div>
        </div>

        {/* Active program */}
        {activeRun && (
          <div className="bg-white border border-[#c2c6d6] rounded-xl p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#545f73] mb-3">Active Program</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-[#171c1f]">{programName}</p>
                <p className="text-sm text-[#545f73] mt-0.5">
                  Day {activeRun.current_day} of {activeRun.total_days_required}
                </p>
              </div>
              <span className="bg-[#e6f4ef] text-[#006947] text-xs font-bold px-3 py-1 rounded-full">
                Active
              </span>
            </div>
          </div>
        )}

        {/* Quick links */}
        <div className="bg-white border border-[#c2c6d6] rounded-xl overflow-hidden">
          {[
            { icon: 'home', label: 'Dashboard', onClick: () => navigate('/dashboard') },
            { icon: 'edit_note', label: 'Log Today', onClick: () => navigate(`/log/${today}`) },
            { icon: 'insights', label: 'View Insights', onClick: () => navigate('/graphs') },
            { icon: 'flag', label: 'Manage Programs', onClick: () => navigate('/programs') },
          ].map(({ icon, label, onClick }, i, arr) => (
            <button
              key={label}
              onClick={onClick}
              className={`w-full flex items-center gap-3 px-5 py-4 text-sm font-medium text-[#171c1f] hover:bg-[#f6fafe] transition-colors ${
                i < arr.length - 1 ? 'border-b border-[#e4e9ed]' : ''
              }`}
            >
              <span className="material-symbols-outlined text-[#0058be] text-lg">{icon}</span>
              {label}
              <span className="material-symbols-outlined text-[#c2c6d6] text-base ml-auto">chevron_right</span>
            </button>
          ))}
        </div>

        {/* Sign out */}
        <div className="bg-white border border-[#c2c6d6] rounded-xl overflow-hidden">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-5 py-4 text-sm font-medium text-[#b91c1c] hover:bg-[#fef2f2] transition-colors"
          >
            <span className="material-symbols-outlined text-[#b91c1c] text-lg">logout</span>
            Sign out
          </button>
        </div>
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e4e9ed]">
        <div className="max-w-2xl mx-auto flex items-center justify-around h-14">
          {[
            { icon: 'home', label: 'Home', active: false, onClick: () => navigate('/dashboard') },
            { icon: 'task_alt', label: 'Tasks', active: false, onClick: () => navigate(`/log/${today}`) },
            { icon: 'insights', label: 'Insights', active: false, onClick: () => navigate('/graphs') },
            { icon: 'person', label: 'Profile', active: true, onClick: () => {} },
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
    </div>
  )
}
