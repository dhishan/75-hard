import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/firebase'
import { useAuthStore } from '@/store/auth'
import Landing from '@/pages/Landing'
import Dashboard from '@/pages/Dashboard'
import Graphs from '@/pages/Graphs'
import DailyLog from '@/pages/DailyLog'
import Programs from '@/pages/Programs'
import Profile from '@/pages/Profile'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore()
  if (loading) return <div className="p-8">Loading...</div>
  if (!user) return <Navigate to="/" replace />
  return <>{children}</>
}

export default function App() {
  const { setUser, setLoading } = useAuthStore()

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUser(user)
      setLoading(false)
    })
    return unsub
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/graphs" element={<PrivateRoute><Graphs /></PrivateRoute>} />
        <Route path="/log/:date" element={<PrivateRoute><DailyLog /></PrivateRoute>} />
        <Route path="/programs" element={<PrivateRoute><Programs /></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
