import { test, expect } from '@playwright/test';

test.describe('Filters', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('can navigate to statistics page and see filters', async ({ page }) => {
        // Navigate to Statistics page via "View All Brands"
        // This link is in the Hero section
        const brandsLink = page.getByRole('link', { name: 'View All Brands' }).first();

        await brandsLink.click();

        // Should go to /statistics
        await expect(page).toHaveURL(/.*statistics/);

        // Check for main heading on statistics page
        await expect(page.getByRole('heading', { name: 'Reliability Statistics' })).toBeVisible();

        // Check for Search input (placeholder depends on default view mode which is brands)
        await expect(page.getByPlaceholder('Search brands...')).toBeVisible();

        // Check for Filters button
        await expect(page.getByRole('button', { name: 'Filters' })).toBeVisible();
    });
});
