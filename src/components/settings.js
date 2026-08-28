import React from 'react';

/**
 * Conversion settings. Every option maps directly onto a field the converter
 * core reads, so nothing here needs to know how matching works.
 */
const Settings = ({ settings, onChange, open, onToggle }) => {
    const set = (key, value) => onChange({ ...settings, [key]: value });

    return (
        <div className="border-t border-slate-200 bg-white">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                className="flex w-full items-center justify-between px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500 transition hover:text-slate-800 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-teal-500"
            >
                Settings
                <span aria-hidden="true" className="text-slate-400">
                    {open ? '−' : '+'}
                </span>
            </button>

            {open && (
                <div className="space-y-3 px-4 pb-4 text-sm">
                    <label className="flex items-center justify-between gap-4">
                        <span className="text-slate-600">Pixels per rem</span>
                        <input
                            type="number"
                            min="1"
                            max="100"
                            value={settings.remConversion}
                            onChange={(event) => set('remConversion', Number(event.target.value) || 16)}
                            className="w-20 rounded-sm border border-slate-300 px-2 py-1 text-right tabular-nums focus:border-teal-500 focus:outline-hidden"
                        />
                    </label>

                    <label className="flex items-center justify-between gap-4">
                        <span className="text-slate-600">
                            Colour tolerance
                            <span className="ml-1 tabular-nums text-slate-400">
                                {Number(settings.colorTolerance).toFixed(3)}
                            </span>
                        </span>
                        <input
                            type="range"
                            min="0"
                            max="0.12"
                            step="0.005"
                            value={settings.colorTolerance}
                            onChange={(event) => set('colorTolerance', Number(event.target.value))}
                            className="w-28"
                        />
                    </label>

                    <label className="flex items-center justify-between gap-4">
                        <span className="text-slate-600">
                            Arbitrary values
                            <span className="block text-xs text-slate-400">
                                Emit <code>w-[13px]</code> instead of giving up
                            </span>
                        </span>
                        <input
                            type="checkbox"
                            checked={settings.arbitraryValues}
                            onChange={(event) => set('arbitraryValues', event.target.checked)}
                            className="size-4 accent-teal-600"
                        />
                    </label>

                    <label className="flex items-center justify-between gap-4">
                        <span className="text-slate-600">
                            Round to theme scale
                            <span className="block text-xs text-slate-400">
                                Snap near misses, and say so
                            </span>
                        </span>
                        <input
                            type="checkbox"
                            checked={settings.roundToScale}
                            onChange={(event) => set('roundToScale', event.target.checked)}
                            className="size-4 accent-teal-600"
                        />
                    </label>

                    <label className="flex items-center justify-between gap-4">
                        <span className="text-slate-600">Tailwind class order</span>
                        <input
                            type="checkbox"
                            checked={settings.sortClasses}
                            onChange={(event) => set('sortClasses', event.target.checked)}
                            className="size-4 accent-teal-600"
                        />
                    </label>
                </div>
            )}
        </div>
    );
};

export default Settings;
