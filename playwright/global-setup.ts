import { chromium, FullConfig } from '@playwright/test'
import axios from 'axios'
import * as fs from 'fs'
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

  // Sign in to get idToken
  const signInResp = await axios.post(
    'http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key',
    { email, password, returnSecureToken: true },
  )
  const { idToken, localId } = signInResp.data

  // Build Firebase auth state that matches what the SDK writes to localStorage
  const authState = {
    [`firebase:authUser:demo-key:[DEFAULT]`]: JSON.stringify({
      uid: localId,
      email,
      displayName: 'E2E Test User',
      stsTokenManager: {
        refreshToken: 'fake-refresh-token',
        accessToken: idToken,
        expirationTime: Date.now() + 3600 * 1000,
      },
      lastLoginAt: String(Date.now()),
      createdAt: String(Date.now()),
    }),
  }

  // Save to storage state file
  const storageStatePath = path.join(__dirname, 'auth-state.json')
  fs.writeFileSync(
    storageStatePath,
    JSON.stringify({
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:5173',
          localStorage: Object.entries(authState).map(([name, value]) => ({ name, value })),
        },
      ],
    }),
  )

  console.log(`✓ Firebase test user created: ${email} (uid: ${localId})`)
  console.log(`✓ Auth state saved to ${storageStatePath}`)
}

export default globalSetup
