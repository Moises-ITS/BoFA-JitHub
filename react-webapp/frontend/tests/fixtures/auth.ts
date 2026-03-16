import { Page } from '@playwright/test'

export const TEST_USER = {
  id: 'test-user-id',
  name: 'Test User',
  email: 'test@njit.edu',
  major: 'Computer Science',
  gpa: 3.8,
  graduationYear: 2026,
  bio: 'Test bio',
  clubs: ['ACM'],
  companies: [],
  interests: ['AI', 'Web Dev'],
  linkedinUrl: null,
}

export const TEST_TOKEN = 'mock-jwt-token'

/** Inject a valid auth session into localStorage and mock /api/auth/me */
export async function setupAuth(page: Page) {
  // Mock the /me endpoint so AuthContext validates the token
  await page.route('**/api/auth/me', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(TEST_USER),
    })
  )

  // Seed localStorage before the page loads
  await page.addInitScript(({ token }) => {
    localStorage.setItem('token', token)
  }, { token: TEST_TOKEN })
}

/** Mock a successful login POST */
export async function mockLogin(page: Page) {
  await page.route('**/api/auth/login', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: TEST_TOKEN, user: TEST_USER }),
    })
  )
}

/** Mock a failed login POST */
export async function mockLoginFailure(page: Page, message = 'Invalid credentials') {
  await page.route('**/api/auth/login', route =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: message }),
    })
  )
}

/** Mock a successful signup POST */
export async function mockSignup(page: Page) {
  await page.route('**/api/auth/signup', route =>
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ token: TEST_TOKEN, user: TEST_USER }),
    })
  )
}
