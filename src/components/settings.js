import React, { useState } from 'react';
import Header from './header';

const Settings = ({ settings, setSettings }) => {
    const [expanded, setExpanded] = useState(false);
    const handleChange = (attribute, value) => {
        setSettings({
            ...settings,
            [attribute]: value,
        });
    };
    return (
        <div
            className={`absolute flex-grow h-screen w-full p-2 px-2 border-box border-b border-gray-500 border-solid transition-all duration-500 ease-in-out ${
                expanded ? 'shadow' : ''
            }`}
            style={{
                maxWidth: '300px',
                right: expanded ? '0px' : '-260px',
                backgroundColor: expanded ? 'white' : 'transparent',
            }}
        >
            <div className="w-full h-full relative text-teal-900">
                <div
                    className="flex tracking-wide text-base items-center uppercase leading-7"
                    style={{ height: '1.75rem' }}
                >
                    <svg
                        fill="none"
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        viewBox="0 0 24 24"
                        class="w-6 h-6 mr-1 cursor-pointer hover:text-teal-600 transition duration-150"
                        onClick={() => {
                            setExpanded(!expanded);
                        }}
                    >
                        <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                    {'Settings'}
                </div>
                {expanded && (
                    <div>
                        <div className="w-full flex justify-between text-sm my-2 items-center">
                            <label>Number of px per rem</label>
                            <input
                                value={settings.classPrefix}
                                onChange={(event) =>
                                    handleChange(
                                        'classPrefix',
                                        event.target.value
                                    )
                                }
                                className="rounded border border-teal-800 border-solid"
                                type="number"
                                id="classPrefix"
                                name="classPrefix"
                                min="5"
                                max="300"
                            ></input>
                        </div>
                        <div className="w-full flex justify-between text-sm my-2 items-center">
                            <label>Prefix</label>
                            <input
                                value={settings.classPrefix}
                                onChange={(event) =>
                                    handleChange(
                                        'classPrefix',
                                        event.target.value
                                    )
                                }
                                className="rounded border border-teal-800 border-solid"
                                type="text"
                                id="classPrefix"
                                name="classPrefix"
                            ></input>
                        </div>
                        <div className="w-full flex justify-between text-sm my-2 items-center">
                            <label>Auto Convert Margin/Padding</label>
                            <input
                                value={settings.autoConvertSpacing}
                                checked={settings.autoConvertSpacing}
                                onChange={(event) =>
                                    handleChange(
                                        'autoConvertSpacing',
                                        event.target.checked
                                    )
                                }
                                className="rounded border border-teal-800 border-solid"
                                type="checkbox"
                                id="autoConvertSpacing"
                                name="autoConvertSpacing"
                            ></input>
                        </div>
                        <div className="w-full flex justify-between text-sm my-2 items-center">
                            <label>Auto Convert Color</label>
                            <input
                                value={settings.autoConvertColor}
                                checked={settings.autoConvertColor}
                                onChange={(event) =>
                                    handleChange(
                                        'autoConvertColor',
                                        event.target.checked
                                    )
                                }
                                className="rounded border border-teal-800 border-solid"
                                type="checkbox"
                                id="autoConvertColor"
                                name="autoConvertColor"
                            ></input>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Settings;
