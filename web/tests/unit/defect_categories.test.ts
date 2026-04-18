import { describe, it, expect } from 'vitest';
import {
    isWearAndTearDefect,
    isReliabilityDefect,
    categorizeDefect,
    getDefaultWearAndTearCodes,
    getWearAndTearCategories
} from '../../app/lib/defect_categories';

describe('Defect Categories', () => {
    it('isWearAndTearDefect should identify wear-and-tear codes correctly', () => {
        // TIRE_CODES
        expect(isWearAndTearDefect('203')).toBe(true);
        expect(isWearAndTearDefect('AC1')).toBe(true);

        // LIGHTING_CODES
        expect(isWearAndTearDefect('475')).toBe(true);
        expect(isWearAndTearDefect('710')).toBe(true);

        // WIPER_CODES
        expect(isWearAndTearDefect('388')).toBe(true);

        // BRAKE_WEAR_CODES
        expect(isWearAndTearDefect('289')).toBe(true);
        expect(isWearAndTearDefect('AC5')).toBe(true);

        // SHOCK_ABSORBER_CODES
        expect(isWearAndTearDefect('241')).toBe(true);
        expect(isWearAndTearDefect('AC2')).toBe(true);

        // EXHAUST_WEAR_CODES
        expect(isWearAndTearDefect('115')).toBe(true);

        // ADMINISTRATIVE_CODES
        expect(isWearAndTearDefect('AC4')).toBe(true);

        // Administrative prefix AP
        expect(isWearAndTearDefect('AP123')).toBe(true);
        // Administrative prefix OP
        expect(isWearAndTearDefect('OP456')).toBe(true);

        // Edge cases - whitespace and casing
        expect(isWearAndTearDefect('  203  ')).toBe(true);
        expect(isWearAndTearDefect('ac1')).toBe(true);
        expect(isWearAndTearDefect(' ap99 ')).toBe(true);
    });

    it('isWearAndTearDefect should return false for reliability codes', () => {
        // AC3 is specifically excluded (reliability defect)
        expect(isWearAndTearDefect('AC3')).toBe(false);

        // General random codes
        expect(isWearAndTearDefect('999')).toBe(false);
        expect(isWearAndTearDefect('')).toBe(false);

        // Ensure that codes not in the set are reliability defects
        expect(isWearAndTearDefect('123')).toBe(false);
    });

    it('isReliabilityDefect should be the inverse of isWearAndTearDefect', () => {
        expect(isReliabilityDefect('203')).toBe(false);
        expect(isReliabilityDefect('AC3')).toBe(true);
    });

    it('categorizeDefect should return correct category string', () => {
        expect(categorizeDefect('203')).toBe('wear_and_tear');
        expect(categorizeDefect('AC3')).toBe('reliability');
    });

    it('getDefaultWearAndTearCodes should return a sorted list of unique codes', () => {
        const codes = getDefaultWearAndTearCodes();

        // It should contain elements
        expect(codes.length).toBeGreaterThan(0);

        // The list should be sorted
        const sortedCodes = [...codes].sort();
        expect(codes).toEqual(sortedCodes);

        // The list should be unique
        const uniqueCodes = new Set(codes);
        expect(codes.length).toBe(uniqueCodes.size);

        // It should contain known codes
        expect(codes).toContain('203');
        expect(codes).toContain('AC1');

        // It should NOT contain excluded codes
        expect(codes).not.toContain('AC3');
    });

    it('getWearAndTearCategories should return structured categories', () => {
        const categories = getWearAndTearCategories();

        // Should have length > 0
        expect(categories.length).toBeGreaterThan(0);

        // Check for specific structure
        const tireCategory = categories.find(c => c.category === 'tires');
        expect(tireCategory).toBeDefined();
        expect(tireCategory?.label).toBe('Tires / Banden');
        expect(tireCategory?.codes.length).toBeGreaterThan(0);

        // Verify all categories have expected properties
        for (const cat of categories) {
            expect(cat.category).toBeDefined();
            expect(cat.label).toBeDefined();
            expect(Array.isArray(cat.codes)).toBe(true);
        }
    });
});
