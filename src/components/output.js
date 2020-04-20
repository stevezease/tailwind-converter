import React from 'react';
import Header from './header';
import { convertCss } from '../scripts/parser/parser';
import TailwindBlock from './tailwind-block';

const Output = ({ settings, cssTree, editorErrors }) => {
    const parseStyleTree = (styleTree, selector) => {
        const tailWindStyles = [];
        const errors = [];
        const isHover = selector.indexOf(':hover') !== -1;
        for (let i = 0; i < styleTree.length; i++) {
            const property = styleTree[i];
            const value = styleTree[property];
            convertCss(property, value, tailWindStyles, errors, settings);
        }
        return [tailWindStyles, errors];
    };
    console.log(cssTree);
    return (
        <div className="flex-grow h-full w-full p-2 border-box overflow-y-auto">
            <div class="flex tracking-wide text-teal-900 text-lg items-center uppercase font-bold mb-2">
                <svg
                    fill="none"
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    viewBox="0 0 64 64"
                    class="h-6 w-auto hidden md:block"
                >
                    <path d="M32 16C24.8 16 20.3 19.6 18.5 26.8C21.2 23.2 24.35 21.85 27.95 22.75C30.004 23.2635 31.4721 24.7536 33.0971 26.4031C35.7443 29.0901 38.8081 32.2 45.5 32.2C52.7 32.2 57.2 28.6 59 21.4C56.3 25 53.15 26.35 49.55 25.45C47.496 24.9365 46.0279 23.4464 44.4029 21.7969C41.7557 19.1099 38.6919 16 32 16ZM18.5 32.2C11.3 32.2 6.8 35.8 5 43C7.7 39.4 10.85 38.05 14.45 38.95C16.504 39.4635 17.9721 40.9536 19.5971 42.6031C22.2443 45.2901 25.3081 48.4 32 48.4C39.2 48.4 43.7 44.8 45.5 37.6C42.8 41.2 39.65 42.55 36.05 41.65C33.996 41.1365 32.5279 39.6464 30.9029 37.9969C28.2557 35.3099 25.1919 32.2 18.5 32.2Z"></path>
                </svg>
                Css Tailwind Converter
            </div>
            {/* {(!cssTree || cssTree.length === 0) && editorErrors && (
                <div className="text-red-900 text-base my-4">
                    Error parsing CSS, please fix any errors
                </div>
            )} */}
            {(!cssTree || cssTree.length === 0) && (
                <div className="text-teal-900 text-base my-4">
                    Type or paste CSS to the right to get started!
                </div>
            )}
            {cssTree &&
                cssTree.length !== 0 &&
                cssTree.map(([selector, styleTree]) => {
                    const [tailWindStyles, errors] = parseStyleTree(
                        styleTree,
                        selector
                    );

                    return (
                        <div className="mb-6 text-sm">
                            <div className="text-gray-700">{selector}</div>
                            {tailWindStyles.length !== 0 && (
                                <TailwindBlock
                                    tailWindStyles={tailWindStyles.join(' ')}
                                />
                            )}
                            {errors.length !== 0 && (
                                <div>
                                    <div className="rounded text-yellow-900 bg-yellow-100 leading-4 p-2 py-1 inline-block text-xs transition">
                                        <div className="font-bold">
                                            Unable to Convert:
                                        </div>
                                        {errors.map((error) => (
                                            <div>{error}</div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
        </div>
    );
};

export default Output;
