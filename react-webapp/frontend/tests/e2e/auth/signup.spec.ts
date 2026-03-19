import { test, expect } from '@playwright/test'
import { mockSignup } from '../../fixtures/auth'

test.describe('Signup Page', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies()
    await page.route('**/api/auth/me', route =>
      route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Unauthorized"}' })
    )
    await page.route('**/api/auth/interests', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    )
  })

  test('renders signup form fields on step 0', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('links back to login page', async ({ page }) => {
    await page.goto('/signup')
    await page.locator('a[href="/login"]').click()
    await expect(page).toHaveURL('/login')
  })

  test('redirects to /home after successful signup', async ({ page }) => {
    await mockSignup(page)
    await page.goto('/signup')

    // Step 0: Account
    await page.locator('input').nth(0).fill('Test User')
    await page.locator('input[type="email"]').fill('test@njit.edu')
    await page.locator('input[type="password"]').first().fill('password123')
    await page.locator('input[type="password"]').nth(1).fill('password123')
    await page.locator('button[type="submit"]').click()

    // Step 1: Academic
    await page.locator('select').first().selectOption('Computer Science')
    await page.locator('input[type="number"]').last().fill('2027')
    await page.locator('button[type="submit"]').click()

    // Step 2: Campus Life (all optional)
    await page.locator('button[type="submit"]').click()

    // Step 3: Profile (optional, submit to create account)
    await page.locator('button[type="submit"]').click()

    await expect(page).toHaveURL('/home', { timeout: 10_000 })
  })
})
