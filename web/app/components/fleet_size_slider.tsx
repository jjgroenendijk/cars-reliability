"use client";

import { useMemo } from "react";

interface FleetSizeSliderProps {
    minFleetSize: number;
    setMinFleetSize: (size: number) => void;
    maxFleetSize: number;
    setMaxFleetSize: (size: number) => void;
    maxAvailable: number;
}



/**
 * Dual handle slider for fleet size filtering.
 * Allows filtering by minimum and maximum fleet size.
 */
export function FleetSizeSlider({
    minFleetSize,
    setMinFleetSize,
    maxFleetSize,
    setMaxFleetSize,
    maxAvailable
}: FleetSizeSliderProps) {
    // Generate dynamic steps: 0, 10, 50, 100, 500, 1000...
    const steps = useMemo(() => {
        const s = [0];
        let current = 10;
        let multiplier = 5;

        // Determine effective max to generating steps up to.
        // If maxAvailable is small, we still want reasonable steps.
        // Default max is 10000, but we want to go up to maxAvailable if higher.
        const limit = Math.max(maxAvailable, 10000);

        while (current <= limit) {
            s.push(current);
            current *= multiplier;
            multiplier = multiplier === 5 ? 2 : 5;
        }

        // Ensure maxAvailable is included if it's not exactly on a step?
        // Actually, let's just make sure the last step covers the max.
        if (s[s.length - 1] < limit) {
            s.push(current);
        }
        return s;
    }, [maxAvailable]);

    const maxStepIndex = steps.length - 1;

    // Helper to find nearest step value
    const findNearestStep = (val: number) => {
        return steps.reduce((prev: number, curr: number) =>
            Math.abs(curr - val) < Math.abs(prev - val) ? curr : prev
        );
    };

    // Helper to find step index for a value (approximate)
    const getStepIndex = (val: number) => {
        // Find index of the step that is closest to val
        let closestIdx = 0;
        let minDiff = Infinity;
        for (let i = 0; i < steps.length; i++) {
            const diff = Math.abs(steps[i] - val);
            if (diff < minDiff) {
                minDiff = diff;
                closestIdx = i;
            }
        }
        return closestIdx;
    };

    const minIndex = getStepIndex(minFleetSize);
    const maxIndex = getStepIndex(maxFleetSize);

    const handleMinSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const idx = Number(e.target.value);
        const val = steps[idx];
        if (val <= maxFleetSize) {
            setMinFleetSize(val);
        }
    };

    const handleMaxSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const idx = Number(e.target.value);
        const val = steps[idx];
        if (val >= minFleetSize) {
            setMaxFleetSize(val);
        }
    };

    const handleMinInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Number(e.target.value);
        // Direct update allowed for typing, but logic might snap later if we only supported steps.
        // For now, allow free typing but cap at max.
        if (val <= maxFleetSize) {
            setMinFleetSize(val);
        }
    };

    const handleMaxInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = Number(e.target.value);
        if (val >= minFleetSize) {
            setMaxFleetSize(val);
        }
    };

    // Percentages for the fill bar
    const minPercent = (minIndex / maxStepIndex) * 100;
    const maxPercent = (maxIndex / maxStepIndex) * 100;

    return (
        <div>
            <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Fleet Size</label>
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        min="0"
                        max={maxFleetSize}
                        value={minFleetSize}
                        onChange={handleMinInputChange}
                        className="w-16 px-1 py-0.5 text-xs text-center bg-zinc-100 dark:bg-zinc-800 border-none rounded focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-zinc-400 text-xs">-</span>
                    <input
                        type="number"
                        min={minFleetSize}
                        // Allow typing up to actual max available even if steps go higher
                        max={steps[steps.length - 1]}
                        value={maxFleetSize}
                        onChange={handleMaxInputChange}
                        className="w-16 px-1 py-0.5 text-xs text-center bg-zinc-100 dark:bg-zinc-800 border-none rounded focus:ring-1 focus:ring-blue-500"
                    />
                </div>
            </div>

            <div className="relative h-6 mt-1">
                {/* Track background */}
                <div className="absolute top-1/2 -translate-y-1/2 w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
                {/* Active range fill */}
                <div
                    className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-blue-500 rounded-full"
                    style={{
                        left: `${minPercent}%`,
                        width: `${maxPercent - minPercent}%`,
                    }}
                />
                {/* Min slider */}
                <input
                    type="range"
                    min={0}
                    max={maxStepIndex}
                    step={1}
                    value={minIndex}
                    onChange={handleMinSliderChange}
                    className="absolute w-full h-1.5 top-1/2 -translate-y-1/2 appearance-none bg-transparent pointer-events-none
            [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:dark:bg-zinc-900 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-500 
            [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md hover:[&::-webkit-slider-thumb]:scale-110 transition-transform"
                />
                {/* Max slider */}
                <input
                    type="range"
                    min={0}
                    max={maxStepIndex}
                    step={1}
                    value={maxIndex}
                    onChange={handleMaxSliderChange}
                    className="absolute w-full h-1.5 top-1/2 -translate-y-1/2 appearance-none bg-transparent pointer-events-none
            [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:dark:bg-zinc-900 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-500 
            [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md hover:[&::-webkit-slider-thumb]:scale-110 transition-transform"
                />
            </div>
            {/* Labels */}
            <div className="flex justify-between text-[10px] text-zinc-400 px-0.5">
                <span>0</span>
                <span>{steps[steps.length - 1].toLocaleString()}</span>
            </div>
        </div>
    );
}
