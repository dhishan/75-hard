import { test, expect } from '@playwright/test'
import { cleanupProgram, cleanupRun, createSampleProgram, startRun } from './helpers'

/**
 * Tests that the UI renders the dashboard correctly after a program is created
 * and a run is started via the API (bypassing UI for setup speed).
 */

test.describe('Dashboard — active run', () => {
  let programId: string
  let upId: string

  test.beforeAll(async () => {
    const today = new Date().toISOString().split('T')[0]
    const { programId: pid } = await createSampleProgram()
    programId = pid
    upId = await startRun(programId, today)
  })

  test.afterAll(async () => {
    await cleanupRun(upId)
    await cleanupProgram(programId)
  })

  test('dashboard shows active run details', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('E2E Sample 75 Hard')).toBeVisible()
    await expect(page.getByText(/Day 1/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Log Today' })).toBeVisible()
  })

  test('clicking Log Today navigates to daily log page', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: 'Log Today' }).click()
    await page.waitForURL(/\/log\/\d{4}-\d{2}-\d{2}/)

    await expect(page.getByText('No added sugar')).toBeVisible()
    await expect(page.getByText('Workout')).toBeVisible()
    await expect(page.getByText('Water')).toBeVisible()
    await expect(page.getByText('Study session')).toBeVisible()
  })

  test('Graphs page shows 4 chart sections', async ({ page }) => {
    await page.goto('/graphs')
    await page.waitForLoadState('networkidle')

    // Use first() because CompletionHeatmap component also renders a "Completion Heatmap" heading
    await expect(page.getByText('Completion Heatmap').first()).toBeVisible()
    await expect(page.getByText('Streaks').first()).toBeVisible()
    await expect(page.getByText('Task Completion Rates').first()).toBeVisible()
    await expect(page.getByText('Points Accumulation').first()).toBeVisible()
  })
})
