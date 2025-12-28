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
        // Debug: Check for error message
        const errorAlert = page.locator('.text-red-600, .bg-red-50').first();
        if (await errorAlert.isVisible()) {
            console.log('Error Alert Found:', await errorAlert.innerText());
        }

        page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

        // Brands dropdown
        const brandsButton = page.getByRole('button', { name: 'Brands' }).first();
        try {
            await expect(brandsButton).toBeVisible({ timeout: 15000 });
        } catch (e) {
            console.log('Brands button not visible. Page content:');
            console.log(await page.content());
            throw e;
        }

        // Open brands dropdown
        await brandsButton.click();
        await expect(page.getByPlaceholder('Search brands...').first()).toBeVisible();

        // Defects dropdown
        const defectsButton = page.getByRole('button', { name: 'Defects' });
        await expect(defectsButton).toBeVisible();

        // Open defects dropdown
        await defectsButton.click();
        await expect(page.getByPlaceholder('Search defect codes...')).toBeVisible();
    });
});
