import { initializeApp } from 'firebase/app'
import {
  getAuth,
  connectAuthEmulator,
  signInWithEmailAndPassword,
  browserLocalPersistence,
  setPersistence,
} from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'demo-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'demo-75hard.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'demo-75hard',
}

export const firebaseApp = initializeApp(firebaseConfig)
export const auth = getAuth(firebaseApp)

if (import.meta.env.DEV || import.meta.env.VITE_E2E === 'true') {
  connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true })
  // Use localStorage so Playwright storageState() can capture auth tokens for E2E tests
  setPersistence(auth, browserLocalPersistence)
  // Expose for E2E test setup
  ;(window as unknown as Record<string, unknown>).__e2eSignIn = async (
    email: string,
    password: string,
  ) => {
    await setPersistence(auth, browserLocalPersistence)
    await signInWithEmailAndPassword(auth, email, password)
  }
}
