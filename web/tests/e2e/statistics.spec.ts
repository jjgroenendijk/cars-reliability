import { test, expect } from '@playwright/test';

test.describe('Statistics Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/statistics');
    });

    test('should not display reliability chart', async ({ page }) => {
        const chart = page.getByText('Reliability Chart (Placeholder)');
        await expect(chart).not.toBeVisible();
    });

    test('should display filter bar and dropdowns', async ({ page }) => {
        const brandsButton = page.getByRole('button', { name: 'Brands' }).first();
        await expect(brandsButton).toBeVisible({ timeout: 15000 });

        await brandsButton.click();
        await expect(page.getByPlaceholder('Search brands...').first()).toBeVisible();

        const defectsButton = page.getByRole('button', { name: 'Defects' });
        await expect(defectsButton).toBeVisible();

        await defectsButton.click();
        await expect(page.getByPlaceholder('Search defect codes...')).toBeVisible();
    });

    test('switching to models updates search placeholder and URL', async ({ page }) => {
        await expect(page.getByPlaceholder('Search brands...').first()).toBeVisible({ timeout: 15000 });

        await page.getByRole('button', { name: 'Models' }).click();
        await expect(page).toHaveURL(/.*view=models/);
        await expect(page.getByPlaceholder('Search models...').first()).toBeVisible();
    });

    test('filters panel shows additional controls', async ({ page }) => {
        const filtersButton = page.getByRole('button', { name: 'Filters' });
        await expect(filtersButton).toBeVisible();

        await filtersButton.click();
        await expect(page.getByText('Vehicle Usage')).toBeVisible();
        await expect(page.getByText('Fuel Type')).toBeVisible();
        await expect(page.getByText('Items per page')).toBeVisible();
    });

    test('shows rankings table', async ({ page }) => {
        await expect(page.getByRole('heading', { name: 'Rankings' })).toBeVisible({ timeout: 15000 });
        await expect(page.getByRole('table')).toBeVisible();
    });
});
