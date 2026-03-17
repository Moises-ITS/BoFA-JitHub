import { test } from '@playwright/test'

test('debug: confirm proxy + auth redirect', async ({ page, context }) => {
  await context.clearCookies()

  const requests: string[] = []
  page.on('request', req => { if (req.url().includes('api')) requests.push(req.url()) })

  await page.route('**/api/auth/me', route =>
    route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"Unauthorized"}' })
  )

  await page.goto('/home')
  await page.waitForTimeout(4000)

  const url = page.url()
  const pathname = await page.evaluate(() => window.location.pathname)
  const loading = await page.evaluate(() => document.body.innerText).catch(() => '')

  console.log('API requests:', requests)
  console.log('URL after 4s:', url)
  console.log('pathname:', pathname)
  console.log('body text snippet:', loading.slice(0, 80))
})
