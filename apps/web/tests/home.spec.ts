import { expect, test } from '@playwright/test';

test('homepage renders hero copy', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate trip' })).toBeVisible();
});
