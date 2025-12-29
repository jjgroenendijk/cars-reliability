"use client";

interface PriceRangeSliderProps {
    minPrice: number;
    maxPrice: number;
    step?: number;
    value: [number, number];
    onChange: (value: [number, number]) => void;
}

/**
 * Dual-handle range slider for price selection.
 * Uses native HTML inputs styled with CSS.
 */
export function PriceRangeSlider({
    minPrice,
    maxPrice,
    step = 5000,
    value,
    onChange,
}: PriceRangeSliderProps) {
    const [minValue, maxValue] = value;

    // Logarithmic scale helpers
    const minLog = Math.log(Math.max(1, minPrice));
    const maxLog = Math.log(Math.max(1, maxPrice));
    const scale = (maxLog - minLog) / 100;

    const toLog = (val: number) => {
        if (val <= 0) return 0;
        return (Math.log(val) - minLog) / scale;
    };

    const fromLog = (percent: number) => {
        if (percent <= 0) return minPrice;
        return Math.round(Math.exp(minLog + (percent * scale)));
    };

    const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let newMin = parseInt(e.target.value, 10);
        if (!isNaN(newMin)) {
            newMin = Math.max(minPrice, Math.min(newMin, maxValue));
            onChange([newMin, maxValue]);
        }
    };

    const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let newMax = parseInt(e.target.value, 10);
        if (!isNaN(newMax)) {
            newMax = Math.max(minValue, Math.min(newMax, maxPrice));
            onChange([minValue, newMax]);
        }
    };

    const handleRangeMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const percent = parseFloat(e.target.value);
        const val = fromLog(percent);
        const newMin = Math.max(minPrice, Math.min(val, maxValue));
        onChange([newMin, maxValue]);
    };

    const handleRangeMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const percent = parseFloat(e.target.value);
        const val = fromLog(percent);
        const newMax = Math.max(minValue, Math.min(val, maxPrice));
        onChange([minValue, newMax]);
    };

    // Calculate percentages for sliders
    const minSliderVal = toLog(minValue);
    const maxSliderVal = toLog(maxValue);

    // Format helper
    const formatPrice = (p: number) => {
        if (p >= 1000000) return `€${(p / 1000000).toFixed(1)}M`;
        if (p >= 1000) return `€${(p / 1000).toFixed(0)}k`;
        return `€${p}`;
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Price Range</label>
                <div className="flex items-center gap-2">
                    <span className="text-zinc-400 text-xs">€</span>
                    <input
                        type="number"
                        min={minPrice}
                        max={maxValue}
                        step={step}
                        value={minValue}
                        onChange={handleMinChange}
                        className="w-20 px-1 py-0.5 text-xs text-center bg-zinc-100 dark:bg-zinc-800 border-none rounded focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-zinc-400 text-xs">-</span>
                    <input
                        type="number"
                        min={minValue}
                        max={maxPrice}
                        step={step}
                        value={maxValue}
                        onChange={handleMaxChange}
                        className="w-20 px-1 py-0.5 text-xs text-center bg-zinc-100 dark:bg-zinc-800 border-none rounded focus:ring-1 focus:ring-blue-500"
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
                        left: `${minSliderVal}%`,
                        width: `${maxSliderVal - minSliderVal}%`,
                    }}
                />
                {/* Min slider */}
                <input
                    type="range"
                    min={0}
                    max={100}
                    step={0.1}
                    value={minSliderVal}
                    onChange={handleRangeMinChange}
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
                    value={maxSliderVal}
                    onChange={handleRangeMaxChange}
                    className="absolute w-full h-1.5 top-1/2 -translate-y-1/2 appearance-none bg-transparent pointer-events-none
            [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:dark:bg-zinc-900 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-blue-500 
            [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md hover:[&::-webkit-slider-thumb]:scale-110 transition-transform"
                />
            </div>
            {/* Labels */}
            <div className="flex justify-between text-[10px] text-zinc-400 px-0.5">
                <span>{formatPrice(minPrice)}</span>
                <span>{formatPrice(maxPrice)}</span>
            </div>
        </div>
    );
}
