import { test, expect } from '@playwright/test'

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/me', route => route.abort())
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('renders JitHub headline', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('JitHub')
  })

  test('renders tagline', async ({ page }) => {
    await expect(page.locator('text=Your NJIT network, visualized.')).toBeVisible()
  })

  test('renders feature pills', async ({ page }) => {
    await expect(page.locator('text=Graph Networking')).toBeVisible()
    await expect(page.locator('text=Opportunity Discovery')).toBeVisible()
    await expect(page.locator('text=Campus Connect')).toBeVisible()
  })

  test('"Sign In" CTA navigates to /login', async ({ page }) => {
    await page.locator('a[href="/login"]').click()
    await expect(page).toHaveURL('/login')
  })

  test('"Create Account" CTA navigates to /signup', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.locator('a[href="/signup"]').click()
    await expect(page).toHaveURL('/signup')
  })

  test('authenticated user is redirected to /home', async ({ page }) => {
    await page.route('**/api/auth/me', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'u1', name: 'Test', email: 't@njit.edu', major: 'CS',
          gpa: 3.5, graduationYear: 2026, bio: '', clubs: [], companies: [], interests: [], linkedinUrl: null,
        }),
      })
    )
    await page.addInitScript(() => localStorage.setItem('token', 'mock-token'))
    await page.goto('/')
    await expect(page).toHaveURL('/home', { timeout: 10_000 })
  })
})
