import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('has title', async ({ page }) => {
        // Expect a title "to contain" a substring.
        await expect(page).toHaveTitle(/Reliability/);
    });

    test('displays main sections', async ({ page }) => {
        // Check for main heading
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

        // Check for navigation links
        await expect(page.getByText('View All Brands', { exact: true }).first()).toBeVisible();
        await expect(page.getByText('View all models', { exact: true }).first()).toBeVisible();
    });
});
