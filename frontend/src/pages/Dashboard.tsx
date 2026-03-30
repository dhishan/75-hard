import { useAuthStore } from '@/store/auth'
import { signOut } from 'firebase/auth'
import { auth } from '@/firebase'

export default function Dashboard() {
  const { user } = useAuthStore()

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <p>Welcome, {user?.displayName}</p>
      <button onClick={() => signOut(auth)} className="mt-4 text-sm underline">
        Sign out
      </button>
    </div>
  )
}
