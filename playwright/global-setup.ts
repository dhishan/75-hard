import { chromium, FullConfig } from '@playwright/test'
import axios from 'axios'
import * as path from 'path'

async function globalSetup(_config: FullConfig) {
  const email = 'e2e-test@75hard.local'
  const password = 'test-password-123'

  // Create user in emulator (idempotent — fails if exists, which is fine)
  try {
    await axios.post(
      'http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key',
      { email, password, returnSecureToken: true },
    )
  } catch {
    // User may already exist from a previous run — that's OK
  }

  // Sign in via a real browser so Firebase SDK handles storage correctly
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto('http://localhost:5173')
  await page.waitForLoadState('networkidle')

  // Use the __e2eSignIn helper exposed by firebase.ts in dev mode
  const error = await page.evaluate(
    async ({ email, password }) => {
      try {
        const signIn = (window as unknown as Record<string, unknown>).__e2eSignIn as
          | ((email: string, password: string) => Promise<void>)
          | undefined
        if (!signIn) return '__e2eSignIn not found on window'
        await signIn(email, password)
        return null
      } catch (e) {
        return String(e)
      }
    },
    { email, password },
  )

  if (error) throw new Error(`Sign-in failed: ${error}`)

  // Wait briefly for IndexedDB writes to complete
  await page.waitForTimeout(1000)

  const storageStatePath = path.join(__dirname, 'auth-state.json')
  await context.storageState({ path: storageStatePath })
  await browser.close()

  console.log(`✓ Firebase test user signed in: ${email}`)
  console.log(`✓ Auth state saved to ${storageStatePath}`)
}

export default globalSetup
