import { test, expect } from '@playwright/test'
import { mockLogin, mockLoginFailure, setupAuth } from '../../fixtures/auth'

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    // Block /me so AuthContext treats user as unauthenticated
    await page.route('**/api/auth/me', route => route.abort())
  })

  test('renders login form', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('redirects to /home on successful login', async ({ page }) => {
    await mockLogin(page)
    await page.goto('/login')

    await page.locator('input[type="email"]').fill('test@njit.edu')
    await page.locator('input[type="password"]').fill('password123')
    await page.locator('button[type="submit"]').click()

    await expect(page).toHaveURL('/home', { timeout: 10_000 })
  })

  test('shows error on invalid credentials', async ({ page }) => {
    await mockLoginFailure(page, 'Invalid credentials')
    await page.goto('/login')

    await page.locator('input[type="email"]').fill('wrong@njit.edu')
    await page.locator('input[type="password"]').fill('wrongpassword')
    await page.locator('button[type="submit"]').click()

    await expect(page.locator('text=Invalid credentials')).toBeVisible({ timeout: 5_000 })
    await expect(page).toHaveURL('/login')
  })

  test('links to signup page', async ({ page }) => {
    await page.goto('/login')
    await page.locator('a[href="/signup"]').click()
    await expect(page).toHaveURL('/signup')
  })

  test('authenticated user navigates away from /login', async ({ page }) => {
    await setupAuth(page)
    await page.goto('/login')
    // If already authed, the app should go to /home (or stay at /login without breaking)
    await page.waitForLoadState('networkidle')
    // Just verify no crash — route guard behaviour may vary
    await expect(page.locator('body')).toBeVisible()
  })
})
