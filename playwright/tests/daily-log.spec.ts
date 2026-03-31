import { test, expect, Page } from '@playwright/test'
import {
  cleanupProgram,
  cleanupRun,
  createSampleProgram,
  startRun,
} from './helpers'

const TODAY = new Date().toISOString().split('T')[0]

test.describe('Daily Log', () => {
  let programId: string
  let upId: string

  test.beforeAll(async () => {
    const { programId: pid } = await createSampleProgram()
    programId = pid
    upId = await startRun(programId, TODAY)
  })

  test.afterAll(async () => {
    await cleanupRun(upId)
    await cleanupProgram(programId)
  })

  async function navigateToLog(page: Page) {
    await page.goto(`/log/${TODAY}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('No added sugar')).toBeVisible({ timeout: 10000 })
  }

  // Helper: click the circular checkbox button for a boolean task card
  async function clickTaskCheckbox(page: Page, taskName: string) {
    const card = page.locator('[class*="rounded-xl"]').filter({ hasText: taskName })
    // The checkbox is the first button in the card (circular check button)
    await card.locator('button').first().click()
  }

  test('complete all required tasks shows success banner', async ({ page }) => {
    await navigateToLog(page)

    // Boolean task — click circular checkbox button
    await clickTaskCheckbox(page, 'No added sugar')

    // Duration/measurement tasks — fill number input
    const workoutCard = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Workout' })
    await workoutCard.locator('input[type="number"]').fill('25')

    const waterCard = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Water' })
    await waterCard.locator('input[type="number"]').fill('3')

    const studyCard = page.locator('[class*="rounded-xl"]').filter({ hasText: 'Study session' })
    await studyCard.locator('input[type="number"]').fill('20')

    await page.getByRole('button', { name: 'SAVE DAILY LOG' }).click()
    await page.waitForSelector('[class*="e6f4ef"], [class*="fef2f2"]', { timeout: 5000 })

    await expect(page.getByText(/Day complete/)).toBeVisible()
    // Required tasks earn 0 points; banner shows "+0 pts"
    await expect(page.getByText(/\+0 pts/)).toBeVisible()
  })

  test('skipping a required task shows penalty banner', async ({ page }) => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
    await page.goto(`/log/${tomorrow}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('No added sugar')).toBeVisible({ timeout: 10000 })

    // Complete only 3 of 4 required tasks — skip No added sugar
    await page.locator('[class*="rounded-xl"]').filter({ hasText: 'Workout' }).locator('input[type="number"]').fill('25')
    await page.locator('[class*="rounded-xl"]').filter({ hasText: 'Water' }).locator('input[type="number"]').fill('3')
    await page.locator('[class*="rounded-xl"]').filter({ hasText: 'Study session' }).locator('input[type="number"]').fill('20')

    await page.getByRole('button', { name: 'SAVE DAILY LOG' }).click()
    await page.waitForSelector('[class*="fef2f2"]', { timeout: 5000 })

    await expect(page.getByText(/Incomplete/)).toBeVisible()
    await expect(page.getByText(/penalty day/)).toBeVisible()
  })

  test('completing optional tasks adds extra points', async ({ page }) => {
    const overmorrow = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]
    await page.goto(`/log/${overmorrow}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('No added sugar')).toBeVisible({ timeout: 10000 })

    // Complete all required
    await clickTaskCheckbox(page, 'No added sugar')
    await page.locator('[class*="rounded-xl"]').filter({ hasText: 'Workout' }).locator('input[type="number"]').fill('25')
    await page.locator('[class*="rounded-xl"]').filter({ hasText: 'Water' }).locator('input[type="number"]').fill('3')
    await page.locator('[class*="rounded-xl"]').filter({ hasText: 'Study session' }).locator('input[type="number"]').fill('20')

    // Complete optionals: skin care (15 pts) + news (20 pts) = 35 pts total
    await clickTaskCheckbox(page, 'Skin care')
    const newsButton = page.locator('[class*="rounded-xl"]').filter({ hasText: 'News/Finance/Podcast' }).getByRole('button', { name: 'news' })
    await newsButton.click()
    await expect(newsButton).toHaveClass(/bg-\[#0058be\]/, { timeout: 3000 })

    await page.getByRole('button', { name: 'SAVE DAILY LOG' }).click()
    await page.waitForSelector('[class*="e6f4ef"], [class*="fef2f2"]', { timeout: 15000 })

    // 0 (required) + 15 (skin care) + 20 (news) = 35 pts
    await expect(page.getByText(/35 pts/)).toBeVisible({ timeout: 5000 })
  })
})
