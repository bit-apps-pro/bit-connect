import { expect, test } from '@playwright/test'

// Smoke coverage for the Bit Connect admin SPA. Validates the full chain:
// authenticated session (auth.setup) -> wp-admin -> plugin admin page -> SPA
// mounts and the plugin has registered its sub-pages.
const ADMIN_URL = '/wp-admin/admin.php?page=bit-connect'

test.describe('Admin — smoke', () => {
  test('loads the Bit Connect admin page and mounts the SPA', async ({ page }) => {
    await page.goto(ADMIN_URL)

    // WordPress admin menu registered the plugin.
    await expect(
      page.getByRole('link', { name: 'Bit Connect', exact: true }).first()
    ).toBeVisible()

    // The React app mounted and rendered Bit Connect content (not a WP error page).
    await expect(page.getByRole('heading', { name: /Bit Connect/i }).first()).toBeVisible()
  })

  test('registers its admin sub-pages in the menu', async ({ page }) => {
    await page.goto(ADMIN_URL)

    // Server-rendered submenu anchors pointing at the SPA hash routes.
    for (const route of ['general', 'settings', 'topic-types']) {
      await expect(
        page.locator(`#adminmenu a[href*="page=bit-connect#/${route}"]`)
      ).toHaveCount(1)
    }
  })
})
