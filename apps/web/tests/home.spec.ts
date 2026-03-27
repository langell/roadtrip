import { expect, test } from '@playwright/test';

test('homepage renders hero copy', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate trip' })).toBeVisible();
});

test('footer links navigate to content pages', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('link', { name: 'About' }).click();
  await expect(page).toHaveURL('/about');
  await expect(
    page.getByRole('heading', { level: 1, name: 'About HopTrip' }),
  ).toBeVisible();

  await page.goto('/');
  await page.getByRole('link', { name: 'Journal' }).click();
  await expect(page).toHaveURL('/journal');
  await expect(
    page.getByRole('heading', { level: 1, name: 'HopTrip Journal' }),
  ).toBeVisible();

  await page.goto('/');
  await page.getByRole('link', { name: 'Route Planner' }).click();
  await expect(page).toHaveURL('/product/route-planner');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Route Planner' }),
  ).toBeVisible();

  await page.goto('/');
  await page.getByRole('link', { name: 'Offline Maps' }).click();
  await expect(page).toHaveURL('/product/offline-maps');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Offline Maps' }),
  ).toBeVisible();

  await page.goto('/');
  await page.getByRole('link', { name: 'Privacy' }).click();
  await expect(page).toHaveURL('/privacy');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Privacy Policy' }),
  ).toBeVisible();

  await page.goto('/');
  await page.getByRole('link', { name: 'Terms' }).click();
  await expect(page).toHaveURL('/terms');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Terms of Service' }),
  ).toBeVisible();
});
