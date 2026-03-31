import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
import { auth } from '@/firebase'
import { useNavigate } from 'react-router-dom'

export default function Landing() {
  const navigate = useNavigate()

  const signIn = async () => {
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-[#f6fafe] font-sans">
      {/* Nav */}
      <nav className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <span className="text-sm font-bold tracking-widest text-[#0058be] uppercase">
          75 Hard Tracker
        </span>
        <div className="hidden sm:flex items-center gap-6 text-sm text-[#545f73]">
          <a href="#" className="hover:text-[#0058be] transition-colors">Dashboard</a>
          <a href="#" className="hover:text-[#0058be] transition-colors">Training</a>
          <a href="#" className="hover:text-[#0058be] transition-colors">Insights</a>
          <a href="#" className="hover:text-[#0058be] transition-colors">Community</a>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-12 flex flex-col lg:flex-row items-center gap-12">
        <div className="flex-1">
          <h1 className="text-5xl sm:text-6xl font-bold leading-tight text-[#171c1f] mb-4">
            Your 75-Day<br />
            <span className="text-[#0058be]">Challenge Tracker</span>
          </h1>
          <p className="text-[#545f73] text-lg mb-8 max-w-md">
            Build discipline, track progress, and crush your goals with our comprehensive 75 Hard challenge platform.
          </p>
          <button
            onClick={signIn}
            className="inline-flex items-center gap-3 px-7 py-3.5 bg-[#0058be] hover:bg-[#2170e4] text-white font-semibold rounded-full transition-colors shadow-lg shadow-blue-200"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 110-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A9.969 9.969 0 0012.545 2C7.021 2 2.543 6.477 2.543 12s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013z"/>
            </svg>
            Sign in with Google
          </button>
        </div>

        {/* Analytics preview card */}
        <div className="flex-shrink-0 w-full max-w-xs">
          <div className="bg-white border border-[#c2c6d6] rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#545f73]">Completion</span>
              <span className="text-xs text-[#6f7a8d] bg-[#eaeef2] px-2 py-0.5 rounded-full">Last 75 days</span>
            </div>
            <p className="text-4xl font-bold text-[#171c1f] mb-1">98.4%</p>
            <p className="text-sm text-[#545f73] mb-5">Average daily completion rate</p>
            {/* Mini heatmap */}
            <div className="grid grid-cols-11 gap-1">
              {Array.from({ length: 77 }).map((_, i) => {
                const intensity = Math.random()
                const bg =
                  intensity > 0.8 ? 'bg-[#0058be]'
                  : intensity > 0.5 ? 'bg-[#2170e4] opacity-70'
                  : intensity > 0.2 ? 'bg-[#c2c6d6]'
                  : 'bg-[#eaeef2]'
                return <div key={i} className={`h-3 rounded-sm ${bg}`} />
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Feature cards */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: 'task_alt',
              title: 'Smart Tracking',
              desc: 'Track all your daily tasks with intelligent reminders and progress insights.',
            },
            {
              icon: 'bar_chart',
              title: 'Progress Analytics',
              desc: 'Visualize your journey with detailed charts and historical performance.',
            },
            {
              icon: 'shield',
              title: 'Shield System',
              desc: 'Protect your streak with earned shield tokens — your safety net on tough days.',
            },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="bg-white border border-[#c2c6d6] rounded-xl p-6 hover:shadow-md transition-shadow">
              <span className="material-symbols-outlined text-[#0058be] text-3xl mb-3 block">{icon}</span>
              <h3 className="font-semibold text-[#171c1f] mb-2">{title}</h3>
              <p className="text-sm text-[#545f73] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust section */}
      <section className="max-w-5xl mx-auto px-6 py-10 text-center">
        <p className="text-[#545f73]">
          Join thousands of people who have completed the{' '}
          <span className="font-semibold text-[#171c1f]">75 Hard challenge</span>
        </p>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#e4e9ed] mt-4 py-6 text-center text-xs text-[#6f7a8d]">
        © {new Date().getFullYear()} 75 Hard Tracker. All rights reserved.
      </footer>
    </div>
  )
}
