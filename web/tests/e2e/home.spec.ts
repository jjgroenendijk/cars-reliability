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

    test('shows top 10 brand rankings', async ({ page }) => {
        const mostReliable = page.getByTestId('ranking-most-reliable-brands');
        const leastReliable = page.getByTestId('ranking-least-reliable-brands');

        await expect(mostReliable.getByTestId('ranking-entry')).toHaveCount(10);
        await expect(leastReliable.getByTestId('ranking-entry')).toHaveCount(10);
    });

    test('shows top 10 model rankings', async ({ page }) => {
        const mostReliable = page.getByTestId('ranking-most-reliable-models');
        const leastReliable = page.getByTestId('ranking-least-reliable-models');

        await expect(mostReliable.getByTestId('ranking-entry')).toHaveCount(10);
        await expect(leastReliable.getByTestId('ranking-entry')).toHaveCount(10);
    });

    test('top 10 links navigate to statistics views', async ({ page }) => {
        await page.getByTestId('ranking-most-reliable-brands')
            .getByRole('link', { name: 'View all brands' })
            .click();
        await expect(page).toHaveURL(/.*statistics/);

        await page.goto('/');
        await page.getByTestId('ranking-least-reliable-brands')
            .getByRole('link', { name: 'View all brands' })
            .click();
        await expect(page).toHaveURL(/.*statistics/);

        await page.goto('/');
        await page.getByTestId('ranking-most-reliable-models')
            .getByRole('link', { name: 'View all models' })
            .click();
        await page.waitForURL('**/statistics?view=models');
        await expect(page).toHaveURL(/\/statistics\?view=models$/);

        await page.goto('/');
        await page.getByTestId('ranking-least-reliable-models')
            .getByRole('link', { name: 'View all models' })
            .click();
        await page.waitForURL('**/statistics?view=models');
        await expect(page).toHaveURL(/\/statistics\?view=models$/);
    });

    test('hero links navigate to lookup and statistics', async ({ page }) => {
        await page.getByRole('link', { name: 'License Plate Lookup' }).click();
        await expect(page).toHaveURL(/.*lookup/);

        await page.goto('/');
        const heroSection = page.locator('section').filter({
            has: page.getByRole('heading', { level: 1 })
        });
        await heroSection.getByRole('link', { name: 'View All Brands', exact: true }).click();
        await expect(page).toHaveURL(/.*statistics/);
    });

    test('data info section links to methodology', async ({ page }) => {
        const infoSection = page.getByRole('heading', { name: 'About this data' });
        await expect(infoSection).toBeVisible();
        await expect(page.getByText(/Last updated:/)).toBeVisible();

        await page.getByRole('link', { name: 'Learn more about the methodology' }).click();
        await expect(page).toHaveURL(/.*about/);
    });
});
