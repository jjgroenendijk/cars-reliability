export function FuelLegend() {
    return (
        <div className="bg-zinc-100 dark:bg-zinc-800/50 rounded-xl p-4 flex flex-wrap gap-6 text-sm justify-center">
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-zinc-600 dark:text-zinc-400">Petrol</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-zinc-600" />
                <span className="text-zinc-600 dark:text-zinc-400">Diesel</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-zinc-600 dark:text-zinc-400">Electric</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-zinc-600 dark:text-zinc-400">LPG</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500" />
                <span className="text-zinc-600 dark:text-zinc-400">Other</span>
            </div>
        </div>
    );
}
