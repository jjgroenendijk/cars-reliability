import { test, expect } from '@playwright/test';

test.describe('Filters', () => {
    test.beforeEach(async ({ page }) => {
        await page.addInitScript(() => window.localStorage.setItem('language', 'en'));
        await page.goto('/');
    });

    test('can navigate to data page and see filters', async ({ page }) => {
        const brandsLink = page.locator('a[href="/data"]').first();

        await brandsLink.click();

        // Should go to /data
        await expect(page).toHaveURL(/.*data/);

        // Check for main heading on data page
        await expect(page.getByRole('heading', { name: 'Data' })).toBeVisible();

        // Check for Search input (placeholder depends on default view mode which is brands)
        await expect(page.getByPlaceholder('Search brands...')).toBeVisible();

        // Check for Filters button
        await expect(page.getByRole('button', { name: 'Filters' })).toBeVisible();
    });
});
