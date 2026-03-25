import { expect, test } from '@playwright/test';

test('homepage renders hero copy', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Plan soulful drives')).toBeVisible();
});
