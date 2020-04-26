import React, { useState } from 'react';
import SEO from '../components/seo';
import Editor from '../components/editor';
import '../style.css';
import Settings from '../components/settings';
import Output from '../components/output';

const IndexPage = () => {
    const [cssTree, setCssTree] = useState([]);
    const [editorErrors, setEditorErrors] = useState(false);
    const [settings, setSettings] = useState({
        remConversion: 16,
        autoConvertSpacing: true,
        autoConvertColor: true,
    });
    return (
        <div
            className="h-screen w-screen max-w-full overflow-hidden flex relative"
            style={{ minWidth: '812px' }}
        >
            <Editor setCssTree={setCssTree} setEditorErrors={setEditorErrors} />
            <SEO
                title="Convert Css To Tailwind"
                meta={[
                    {
                        name: 'google-site-verification',
                        content: 'MiBwrqoOFZRpmJ4Ar52jHqGy91bRDEdXqFiUZS9pxB8',
                    },
                ]}
            />
            <div className="flex flex-col h-full flex-grow relative">
                <Output
                    cssTree={cssTree}
                    settings={settings}
                    editorErrors={editorErrors}
                />
                <a
                    href="https://github.com/stevezease/tailwind-converter"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <svg
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="absolute w-5 h-5 hover:text-teal-600 transition duration-150 cursor-pointer"
                        style={{ right: '40px', top: '13px' }}
                    >
                        <path
                            fill-rule="evenodd"
                            d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
                        ></path>
                    </svg>
                </a>
                <Settings setSettings={setSettings} settings={settings} />
            </div>
        </div>
    );
};

export default IndexPage;
