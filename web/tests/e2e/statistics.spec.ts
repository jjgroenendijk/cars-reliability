import { test, expect } from '@playwright/test';

test.describe('Data Page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/data');
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
        if (await defectsButton.count()) {
            await expect(defectsButton).toBeVisible({ timeout: 15000 });
            await defectsButton.click();
            await expect(page.getByPlaceholder('Search defect codes...')).toBeVisible();
        }
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
        await expect(page.locator('label', { hasText: 'Fuel Type' })).toBeVisible();
        await expect(page.getByText('Items per page')).toBeVisible();
    });

    test('shows rankings table', async ({ page }) => {
        await expect(page.getByRole('heading', { name: 'Rankings' })).toBeVisible({ timeout: 15000 });
        await expect(page.getByRole('table')).toBeVisible();
    });

    test('formats average age as years and aligns numeric header text', async ({ page }) => {
        const table = page.getByRole('table');
        await expect(table).toBeVisible({ timeout: 15000 });

        const headers = table.locator('thead th');
        const headerCount = await headers.count();
        let avgAgeIndex = -1;

        for (let i = 0; i < headerCount; i += 1) {
            const headerText = (await headers.nth(i).innerText()).replace(/\s+/g, ' ').trim();
            if (headerText.includes('Avg Age')) {
                avgAgeIndex = i;
                break;
            }
        }

        expect(avgAgeIndex).toBeGreaterThanOrEqual(0);

        const avgAgeCells = table.locator(`tbody tr td:nth-child(${avgAgeIndex + 1})`);
        await expect(avgAgeCells.first()).toBeVisible();
        await expect(avgAgeCells.first()).not.toContainText('%');

        const alignment = await page.evaluate((columnIndex) => {
            const tableElement = document.querySelector('table');
            const header = tableElement?.querySelectorAll('thead th')[columnIndex];
            const headerLabel = header?.querySelector('span');
            const cell = tableElement?.querySelector(`tbody tr td:nth-child(${columnIndex + 1})`);

            if (!headerLabel || !cell) {
                return null;
            }

            const range = document.createRange();
            range.selectNodeContents(cell);
            const rects = Array.from(range.getClientRects());
            const cellTextRight = rects.at(-1)?.right ?? cell.getBoundingClientRect().right;

            return {
                headerTextRight: headerLabel.getBoundingClientRect().right,
                cellTextRight,
            };
        }, avgAgeIndex);

        expect(alignment).not.toBeNull();
        expect(Math.abs(alignment!.headerTextRight - alignment!.cellTextRight)).toBeLessThan(2);
    });
});

test.describe('Statistics Page', () => {
    test('shows aggregate statistics', async ({ page }) => {
        await page.goto('/statistics');

        await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible({ timeout: 15000 });
        await expect(page.getByText('Vehicles', { exact: true })).toBeVisible();
        await expect(page.getByText('APK Inspections', { exact: true })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Fuel Mix' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Standout Rankings' })).toBeVisible();
    });
});
