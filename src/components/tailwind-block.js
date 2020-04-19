import React, { useState, useEffect } from 'react';
import * as clipboard from 'clipboard-polyfill';

const TailwindBlock = ({ tailWindStyles }) => {
    const [copied, setCopied] = useState(false);
    const [copiedText, setCopiedText] = useState('');
    useEffect(() => {
        if (tailWindStyles !== copiedText) {
            setCopied(false);
        }
    });
    return (
        <div>
            <div
                className={`rounded h-6 leading-6 cursor-pointer px-1 inline-block transition ${
                    copied
                        ? 'text-green-900 bg-green-200'
                        : 'text-teal-900 bg-gray-200 hover:bg-teal-800 hover:text-white'
                }`}
                onClick={() => {
                    clipboard.writeText(tailWindStyles);
                    setCopied(true);
                    setCopiedText(tailWindStyles);
                }}
            >
                <div className="flex items-center">
                    <svg
                        fill="none"
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        viewBox="0 0 24 24"
                        className="w-5 h-5 mr-1"
                    >
                        <path
                            d={`${
                                copied
                                    ? 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'
                                    : 'M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3'
                            }`}
                        ></path>
                    </svg>
                    {tailWindStyles}
                </div>
            </div>
        </div>
    );
};

export default React.memo(TailwindBlock);
