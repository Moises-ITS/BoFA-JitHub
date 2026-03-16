import { test, expect } from '@playwright/test'
import { setupAuth } from '../../fixtures/auth'

const PROTECTED = ['/home', '/profile', '/eden', '/opportunities', '/research', '/network']

test.describe('Protected Route Guards', () => {
  test('unauthenticated user is redirected to / from protected routes', async ({ page }) => {
    // Block /me so no session is restored
    await page.route('**/api/auth/me', route => route.abort())

    for (const route of PROTECTED) {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      const url = new URL(page.url())
      expect(['/', '/login'], `Expected redirect from ${route}`).toContain(url.pathname)
    }
  })

  test('authenticated user can reach /home', async ({ page }) => {
    await setupAuth(page)
    await page.goto('/home')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL('/home')
  })

  test('authenticated user can reach /profile', async ({ page }) => {
    await setupAuth(page)
    await page.goto('/profile')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL('/profile')
  })

  test('authenticated user can reach /network', async ({ page }) => {
    await setupAuth(page)
    // Also mock the graph data endpoint if it exists
    await page.route('**/api/**', route => route.fulfill({ status: 200, body: '[]' })).catch(() => {})
    await page.goto('/network')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL('/network')
  })
})
