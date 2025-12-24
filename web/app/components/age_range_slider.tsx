"use client";

interface AgeRangeSliderProps {
    minAge: number;
    maxAge: number;
    value: [number, number];
    onChange: (value: [number, number]) => void;
}

/**
 * Dual-handle range slider for vehicle age selection.
 * Uses native HTML inputs styled with CSS.
 */
export function AgeRangeSlider({
    minAge,
    maxAge,
    value,
    onChange,
}: AgeRangeSliderProps) {
    const [minValue, maxValue] = value;

    const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newMin = parseInt(e.target.value, 10);
        if (newMin <= maxValue) {
            onChange([newMin, maxValue]);
        }
    };

    const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newMax = parseInt(e.target.value, 10);
        if (newMax >= minValue) {
            onChange([minValue, newMax]);
        }
    };

    // Calculate percentage for track fill
    const minPercent = ((minValue - minAge) / (maxAge - minAge)) * 100;
    const maxPercent = ((maxValue - minAge) / (maxAge - minAge)) * 100;

    return (
        <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Vehicle Age: {minValue} - {maxValue} years
            </label>
            <div className="relative h-6">
                {/* Track background */}
                <div className="absolute top-1/2 -translate-y-1/2 w-full h-2 bg-gray-200 dark:bg-gray-700 rounded" />
                {/* Active range fill */}
                <div
                    className="absolute top-1/2 -translate-y-1/2 h-2 bg-blue-500 rounded"
                    style={{
                        left: `${minPercent}%`,
                        width: `${maxPercent - minPercent}%`,
                    }}
                />
                {/* Min slider */}
                <input
                    type="range"
                    min={minAge}
                    max={maxAge}
                    value={minValue}
                    onChange={handleMinChange}
                    className="absolute w-full h-2 top-1/2 -translate-y-1/2 appearance-none bg-transparent pointer-events-none
            [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-white"
                />
                {/* Max slider */}
                <input
                    type="range"
                    min={minAge}
                    max={maxAge}
                    value={maxValue}
                    onChange={handleMaxChange}
                    className="absolute w-full h-2 top-1/2 -translate-y-1/2 appearance-none bg-transparent pointer-events-none
            [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:cursor-pointer
            [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-white"
                />
            </div>
            {/* Labels */}
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                <span>{minAge} yr</span>
                <span>{maxAge} yr</span>
            </div>
        </div>
    );
}
