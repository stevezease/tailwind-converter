import React from 'react';

/**
 * The value/class table that is the substance of a reference page.
 *
 * `also` is the reason this is a component rather than markup inline in the
 * template: when a utility sets more than the property being documented, the
 * table has to say so on that row. `truncate` under `text-overflow` is the
 * clearest case — a reader who copies it because they wanted an ellipsis also
 * gets `overflow: hidden` and `white-space: nowrap`, and finding that out from
 * the rendered page is much better than finding it out from a broken layout.
 */
const MappingTable = ({ property, rows, caption }) => (
    <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
            {caption && (
                <caption className="pb-2 text-left text-xs text-slate-500">{caption}</caption>
            )}
            <thead>
                <tr className="border-b border-slate-300 text-[11px] uppercase tracking-widest text-slate-500">
                    <th scope="col" className="py-2 pr-4 font-semibold">
                        CSS
                    </th>
                    <th scope="col" className="py-2 font-semibold">
                        Tailwind
                    </th>
                </tr>
            </thead>
            <tbody>
                {rows.map((row) => (
                    <tr
                        key={`${row.value}-${row.utility}`}
                        className="border-b border-slate-100 align-top"
                    >
                        <td className="py-1.5 pr-4 font-mono text-[13px] text-slate-700">
                            {property}: {row.value};
                        </td>
                        <td className="py-1.5 font-mono text-[13px] text-teal-800">
                            {row.utility}
                            {row.also.length > 0 && (
                                <span className="ml-2 font-sans text-[11px] text-amber-700">
                                    also sets {row.also.join(', ')}
                                </span>
                            )}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

export default MappingTable;
