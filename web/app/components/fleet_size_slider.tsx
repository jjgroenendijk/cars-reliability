"use client";

interface FleetSizeSliderProps {
    max: number;
    value: number;
    onChange: (value: number) => void;
}

// Predefined steps for the slider (logarithmic-ish scale)
const FLEET_SIZE_STEPS = [0, 50, 100, 250, 500, 1000, 2500, 5000, 10000];

/**
 * Slider for minimum fleet size threshold.
 * Uses predefined steps for more intuitive control.
 */
export function FleetSizeSlider({ max, value, onChange }: FleetSizeSliderProps) {
    // Find the closest step to the current value
    const getCurrentStep = () => {
        const validSteps = FLEET_SIZE_STEPS.filter((s) => s <= max);
        let closest = 0;
        for (const step of validSteps) {
            if (step <= value) closest = validSteps.indexOf(step);
        }
        return closest;
    };

    const validSteps = FLEET_SIZE_STEPS.filter((s) => s <= max);
    const currentStep = getCurrentStep();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const stepIndex = parseInt(e.target.value, 10);
        onChange(validSteps[stepIndex] ?? 0);
    };

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Min Fleet Size: {value.toLocaleString()} vehicles
            </label>
            <div className="relative">
                <input
                    type="range"
                    min={0}
                    max={validSteps.length - 1}
                    value={currentStep}
                    onChange={handleChange}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-white"
                />
            </div>
            {/* Labels */}
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>0</span>
                <span>{validSteps[validSteps.length - 1]?.toLocaleString() ?? max}</span>
            </div>
        </div>
    );
}
