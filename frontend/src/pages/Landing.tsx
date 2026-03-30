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
    <div className="min-h-screen flex flex-col items-center justify-center gap-6">
      <h1 className="text-4xl font-bold">75 Hard Tracker</h1>
      <p className="text-gray-500">Track your challenge, earn shields, beat the clock.</p>
      <button
        onClick={signIn}
        className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
      >
        Sign in with Google
      </button>
    </div>
  )
}
