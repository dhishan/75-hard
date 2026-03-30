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

  test('complete all required tasks shows success banner', async ({ page }) => {
    await navigateToLog(page)

    const sugarCard = page.locator('[class*="rounded-lg"]').filter({ hasText: 'No added sugar' })
    await sugarCard.locator('input[type="checkbox"]').check()

    const workoutCard = page.locator('[class*="rounded-lg"]').filter({ hasText: 'Workout' })
    await workoutCard.locator('input[type="number"]').fill('25')

    const waterCard = page.locator('[class*="rounded-lg"]').filter({ hasText: 'Water' })
    await waterCard.locator('input[type="number"]').fill('3')

    const studyCard = page.locator('[class*="rounded-lg"]').filter({ hasText: 'Study session' })
    await studyCard.locator('input[type="number"]').fill('20')

    await page.getByRole('button', { name: 'Save Log' }).click()
    await page.waitForSelector('[class*="bg-green"]', { timeout: 5000 })

    await expect(page.getByText(/Day complete/)).toBeVisible()
    await expect(page.getByText(/325 pts/)).toBeVisible()
  })

  test('skipping a required task shows penalty banner', async ({ page }) => {
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
    await page.goto(`/log/${tomorrow}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('No added sugar')).toBeVisible({ timeout: 10000 })

    // Complete only 3 of 4 required tasks — skip No added sugar
    await page.locator('[class*="rounded-lg"]').filter({ hasText: 'Workout' }).locator('input[type="number"]').fill('25')
    await page.locator('[class*="rounded-lg"]').filter({ hasText: 'Water' }).locator('input[type="number"]').fill('3')
    await page.locator('[class*="rounded-lg"]').filter({ hasText: 'Study session' }).locator('input[type="number"]').fill('20')

    await page.getByRole('button', { name: 'Save Log' }).click()
    await page.waitForSelector('[class*="bg-red"]', { timeout: 5000 })

    await expect(page.getByText(/Incomplete/)).toBeVisible()
    await expect(page.getByText(/penalty day/)).toBeVisible()
  })

  test('completing optional tasks adds extra points', async ({ page }) => {
    const overmorrow = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]
    await page.goto(`/log/${overmorrow}`)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('No added sugar')).toBeVisible({ timeout: 10000 })

    // Complete all required
    await page.locator('[class*="rounded-lg"]').filter({ hasText: 'No added sugar' }).locator('input[type="checkbox"]').check()
    await page.locator('[class*="rounded-lg"]').filter({ hasText: 'Workout' }).locator('input[type="number"]').fill('25')
    await page.locator('[class*="rounded-lg"]').filter({ hasText: 'Water' }).locator('input[type="number"]').fill('3')
    await page.locator('[class*="rounded-lg"]').filter({ hasText: 'Study session' }).locator('input[type="number"]').fill('20')

    // Complete optionals: skin care + news
    await page.locator('[class*="rounded-lg"]').filter({ hasText: 'Skin care' }).locator('input[type="checkbox"]').check()
    await page.locator('[class*="rounded-lg"]').filter({ hasText: 'News/Finance/Podcast' }).getByRole('button', { name: 'news' }).click()

    await page.getByRole('button', { name: 'Save Log' }).click()
    await page.waitForSelector('[class*="bg-green"]', { timeout: 5000 })

    // 325 + 15 (skin care) + 20 (news) = 360
    await expect(page.getByText(/360 pts/)).toBeVisible()
  })
})
