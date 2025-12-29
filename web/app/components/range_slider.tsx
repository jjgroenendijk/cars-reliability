"use client";

interface RangeSliderProps {
    /** Slider label displayed above */
    label: string;
    /** Absolute minimum value from metadata */
    min: number;
    /** Absolute maximum value from metadata */
    max: number;
    /** Current [min, max] selection */
    value: [number, number];
    /** Callback when selection changes */
    onChange: (value: [number, number]) => void;
    /** Optional unit label (e.g., "years") */
    unit?: string;
    /** Optional custom value formatter for display labels */
    formatValue?: (value: number) => string;
    /** Input field width class (default: w-16) */
    inputWidth?: string;
}

/**
 * Generic dual-handle range slider with logarithmic stepping.
 * 
 * Slider positions map logarithmically to values, making it easier
 * to select from wide ranges (e.g., 0 to 8,000,000 for prices).
 * Minimum step is 1 to ensure integer values.
 */
export function RangeSlider({
    label,
    min,
    max,
    value,
    onChange,
    unit,
    formatValue,
    inputWidth = "w-16",
}: RangeSliderProps) {
    const [minValue, maxValue] = value;

    // Logarithmic scale helpers
    // Use log1p to handle 0 values (log(1+x) instead of log(x))
    const logMin = Math.log1p(min);
    const logMax = Math.log1p(max);
    const logScale = (logMax - logMin) / 100;

    // Convert actual value to slider percentage (0-100)
    const toLogPercent = (val: number): number => {
        if (val <= min) return 0;
        if (val >= max) return 100;
        return (Math.log1p(val) - logMin) / logScale;
    };

    // Convert slider percentage (0-100) to actual value
    const fromLogPercent = (percent: number): number => {
        if (percent <= 0) return min;
        if (percent >= 100) return max;
        const val = Math.expm1(logMin + percent * logScale);
        // Ensure minimum step of 1
        return Math.max(min, Math.round(val));
    };

    // Slider percentages
    const minPercent = toLogPercent(minValue);
    const maxPercent = toLogPercent(maxValue);

    // Handlers for slider movement
    const handleMinSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const percent = parseFloat(e.target.value);
        const newVal = fromLogPercent(percent);
        if (newVal <= maxValue) {
            onChange([newVal, maxValue]);
        }
    };

    const handleMaxSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const percent = parseFloat(e.target.value);
        const newVal = fromLogPercent(percent);
        if (newVal >= minValue) {
            onChange([minValue, newVal]);
        }
    };

    // Handlers for direct input
    const handleMinInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = parseInt(e.target.value, 10);
        if (!isNaN(newVal)) {
            const clamped = Math.max(min, Math.min(newVal, maxValue));
            onChange([clamped, maxValue]);
        }
    };

    const handleMaxInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVal = parseInt(e.target.value, 10);
        if (!isNaN(newVal)) {
            const clamped = Math.max(minValue, Math.min(newVal, max));
            onChange([minValue, clamped]);
        }
    };

    // Default formatter
    const format = formatValue ?? ((v: number) => v.toLocaleString());

    return (
        <div>
            <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    {label}
                </label>
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        min={min}
                        max={maxValue}
                        value={minValue}
                        onChange={handleMinInputChange}
                        className={`${inputWidth} px-1 py-0.5 text-xs text-center bg-zinc-100 dark:bg-zinc-800 border-none rounded focus:ring-1 focus:ring-blue-500`}
                    />
                    <span className="text-zinc-400 text-xs">-</span>
                    <input
                        type="number"
                        min={minValue}
                        max={max}
                        value={maxValue}
                        onChange={handleMaxInputChange}
                        className={`${inputWidth} px-1 py-0.5 text-xs text-center bg-zinc-100 dark:bg-zinc-800 border-none rounded focus:ring-1 focus:ring-blue-500`}
                    />
                    {unit && <span className="text-xs text-zinc-500">{unit}</span>}
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
                    max={100}
                    step={0.1}
                    value={minPercent}
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
                    max={100}
                    step={0.1}
                    value={maxPercent}
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
                <span>{format(min)}</span>
                <span>{format(max)}</span>
            </div>
        </div>
    );
}
