import { test, expect } from '@playwright/test';

test.describe('Lookup', () => {
    test('escapes defect IDs in RDW description queries', async ({ page }) => {
        const defect_id = "A' OR '1'='1";

        await page.route('https://opendata.rdw.nl/resource/m9d7-ebf2.json**', async (route) => {
            await route.fulfill({
                json: [{
                    kenteken: 'AB123C',
                    merk: 'TEST',
                    handelsbenaming: 'MODEL',
                    datum_eerste_toelating: '20200101',
                    vervaldatum_apk: '20990101',
                }],
            });
        });

        await page.route('https://opendata.rdw.nl/resource/sgfe-77wx.json**', async (route) => {
            await route.fulfill({
                json: [{
                    kenteken: 'AB123C',
                    meld_datum_door_keuringsinstantie: '20250101',
                    meld_tijd_door_keuringsinstantie: '1200',
                    soort_meldingomschrijving: 'Afgekeurd',
                    km_stand: '12345',
                }],
            });
        });

        await page.route('https://opendata.rdw.nl/resource/a34c-vvps.json**', async (route) => {
            await route.fulfill({
                json: [{
                    kenteken: 'AB123C',
                    meld_datum_door_keuringsinstantie: '20250101',
                    gebrek_identificatie: defect_id,
                    aantal_gebreken: '1',
                }],
            });
        });

        await page.route('https://opendata.rdw.nl/resource/hx2c-gt7k.json**', async (route) => {
            await route.fulfill({
                json: [{
                    gebrek_identificatie: defect_id,
                    gebrek_omschrijving: 'Escaped description',
                }],
            });
        });

        await page.addInitScript(() => window.localStorage.setItem('language', 'en'));
        await page.goto('/lookup');

        const description_request = page.waitForRequest((request) =>
            request.url().includes('/resource/hx2c-gt7k.json')
        );

        await page.locator('#license-plate').fill('AB-123-C');
        await page.getByRole('button', { name: 'Search' }).click();

        const request = await description_request;
        const where = new URL(request.url()).searchParams.get('$where');

        expect(where).toBe("gebrek_identificatie='A'' OR ''1''=''1'");
        await expect(page.getByText('Escaped description')).toBeVisible();
    });
});
