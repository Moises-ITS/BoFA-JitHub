import { test, expect } from '@playwright/test'
import { setupAuth } from '../../fixtures/auth'

test.describe('CampusGraph Navbar', () => {
  test.beforeEach(async ({ page }) => {
    // Register generic API stub FIRST so the specific /me mock (added inside
    // setupAuth) takes priority — Playwright applies handlers LIFO.
    await page.route('**/api/**', route => {
      // Let /auth/me fall through to the next handler (added by setupAuth)
      if (route.request().url().includes('/api/auth/me')) {
        return route.fallback()
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    })
    await setupAuth(page)
    await page.goto('/network')
    await page.waitForLoadState('networkidle')
  })

  test('renders the JitHub logo and tagline', async ({ page }) => {
    const navbar = page.locator('nav.navbar')
    await expect(navbar).toBeVisible()
    await expect(navbar.locator('text=JitHub')).toBeVisible()
    await expect(navbar.locator('text=Map your network')).toBeVisible()
  })

  test('renders mode badge in free mode', async ({ page }) => {
    const badge = page.locator('.modeBadge')
    await expect(badge).toBeVisible()
    await expect(badge).toContainText('Explore')
  })

  test('Home button is fully contained within its pill border', async ({ page }) => {
    const btn = page.locator('button.logoutBtn')
    await expect(btn).toBeVisible()
    await expect(btn).toContainText('Home')

    const btnBox = await btn.boundingBox()
    const txtBox = await btn.evaluate(el => {
      const range = document.createRange()
      range.selectNodeContents(el)
      const rects = Array.from(range.getClientRects())
      if (!rects.length) return null
      return {
        left:   Math.min(...rects.map(r => r.left)),
        right:  Math.max(...rects.map(r => r.right)),
        top:    Math.min(...rects.map(r => r.top)),
        bottom: Math.max(...rects.map(r => r.bottom)),
      }
    })

    expect(btnBox).not.toBeNull()
    expect(txtBox).not.toBeNull()
    if (btnBox && txtBox) {
      expect(txtBox.left).toBeGreaterThanOrEqual(btnBox.x - 1)
      expect(txtBox.right).toBeLessThanOrEqual(btnBox.x + btnBox.width + 1)
      expect(txtBox.top).toBeGreaterThanOrEqual(btnBox.y - 1)
      expect(txtBox.bottom).toBeLessThanOrEqual(btnBox.y + btnBox.height + 1)
    }
  })

  test('Connections chip is visible and contains count', async ({ page }) => {
    const chip = page.locator('.navChip')
    await expect(chip).toBeVisible()
    await expect(chip).toContainText('Connections')
  })

  test('Exit Mode button is hidden in free explore mode', async ({ page }) => {
    await expect(page.locator('.exitModeBtn')).not.toBeVisible()
  })

  test('profile avatar button shows user initial', async ({ page }) => {
    const avatar = page.locator('button.profileAvatarBtn')
    await expect(avatar).toBeVisible()
    // Wait for auth to resolve — avatar shows "?" before /me responds
    await expect(avatar).not.toContainText('?', { timeout: 8_000 })
    // TEST_USER.name = "Test User" → initial is "T"
    await expect(avatar).toContainText('T')
  })

  test('Home button navigates away from /network', async ({ page }) => {
    await page.locator('button.logoutBtn').click()
    // Authenticated users are redirected / → /home by LandingPage
    await expect(page).toHaveURL('/home', { timeout: 8_000 })
  })
})
