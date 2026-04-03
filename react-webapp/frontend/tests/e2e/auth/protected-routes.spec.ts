import { test, expect } from '@playwright/test'
import { setupAuth } from '../../fixtures/auth'

const PROTECTED = ['/home', '/profile', '/events', '/opportunities', '/network']

test.describe('Protected Route Guards', () => {
  test('unauthenticated user is redirected to / from protected routes', async ({ page }) => {
    // No localStorage token set — AuthContext will skip /me and set user=null immediately
    await page.route('**/api/auth/me', route =>
      route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Unauthorized"}' })
    )

    for (const route of PROTECTED) {
      await page.goto(route)
      // Poll the in-page URL — SPA redirects via replaceState don't fire a load event
      await page.waitForFunction(
        () => ['/', '/login'].includes(window.location.pathname),
        { timeout: 8_000 }
      )
      const pathname = new URL(page.url()).pathname
      expect(['/', '/login'], `Expected redirect from ${route}`).toContain(pathname)
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
    await page.route('**/api/**', route => route.fulfill({ status: 200, body: '[]' }))
    await page.goto('/network')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL('/network')
  })
})
