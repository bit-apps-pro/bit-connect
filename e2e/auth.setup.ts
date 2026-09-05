import { test as setup } from '@playwright/test'
import path from 'node:path'

const authFile = path.join(process.cwd(), 'playwright/.auth/user.json')

setup('authenticate', async ({ page }) => {
  const username = process.env.WORDPRESS_ADMIN_USER
  const password = process.env.WORDPRESS_ADMIN_PASSWORD

  if (!username || !password) {
    throw new Error(
      'Missing environment variables: WORDPRESS_ADMIN_USER, or WORDPRESS_ADMIN_PASSWORD'
    )
  }

  await page.goto('/wp-login.php')

  // Use stable WordPress element IDs — labels vary by locale and login plugins.
  await page.locator('#user_login').fill(username)
  await page.locator('#user_pass').fill(password)
  await page.locator('#wp-submit').click()
  await page.waitForLoadState('networkidle')

  // WordPress may show a one-time "Administration email verification" screen
  // after login — dismiss it so we land in wp-admin.
  if (page.url().includes('confirm_admin_email')) {
    await page.getByRole('link', { name: 'Remind me later' }).click()
    await page.waitForLoadState('networkidle')
  }

  await page.waitForURL('**/wp-admin/**', { timeout: 15_000 })

  await page.context().storageState({ path: authFile })
})
