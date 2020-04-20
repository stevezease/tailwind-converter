// https://github.com/scniro/react-codemirror2/issues/83
import React, { useState } from 'react';
import { Controlled as CodeMirror } from 'react-codemirror2';
import 'codemirror/addon/edit/matchbrackets';
import 'codemirror/addon/edit/closebrackets';
import 'codemirror/addon/comment/comment';
import 'codemirror/addon/lint/lint.css';
import 'codemirror/addon/search/match-highlighter';
import parseCSS from 'css-rules';
import { css } from 'js-beautify';
import CSSLint from 'csslint';
import 'codemirror/mode/css/css';
import 'codemirror/addon/lint/lint';
import 'codemirror/addon/lint/css-lint.js';
import _ from 'lodash';

if (typeof window !== `undefined`) {
    window.CSSLint = CSSLint.CSSLint;
}

const initialEditorOptions = {
    value: '/* PASTE CSS HERE */',
    data: {},
    editor: {},
};

const debouncedUpdateTree = _.debounce(
    (setCssTree, parse, value, setEditorErrors, errors) => {
        setCssTree(parse(value));
        setEditorErrors(errors);
        console.log(errors);
    },
    500
);

const Editor = ({ setCssTree, setEditorErrors }) => {
    const [editorState, setEditorState] = useState(initialEditorOptions);
    const tidy = () => {
        try {
            setEditorState(() => {
                return {
                    ...editorState,
                    value: css(editorState.value),
                };
            });
        } catch (e) {
            console.log('error formatting', e);
        }
    };
    const parse = (cssString) => {
        try {
            const parsedVal = parseCSS(cssString);
            return parsedVal;
        } catch (e) {
            console.error('error parsing CSS', e);
        }
    };
    return (
        <div className="relative h-full w-4/12">
            <div
                className="absolute top-0 right-0 m-2 z-10 cursor-pointer text-gray-500 hover:text-gray-100"
                onClick={() => {
                    tidy();
                }}
            >
                <div class="font-bold" style={{ fontSize: '0.5rem' }}>
                    TIDY
                </div>
                <svg
                    fill="none"
                    stroke="currentColor"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    className="w-6 h-4"
                >
                    <path d="M4 6h16M4 12h16m-7 6h7"></path>
                </svg>
            </div>
            {typeof window !== 'undefined' && window.navigator && (
                <CodeMirror
                    value={editorState.value}
                    options={{
                        mode: 'css',
                        theme: 'material',
                        lineNumbers: true,
                        matchBrackets: true,
                        autoCloseBrackets: true,
                        gutters: ['CodeMirror-lint-markers'],
                        lint: true,
                    }}
                    onBeforeChange={(editor, data, value) => {
                        setEditorState({ editor, data, value });
                    }}
                    onChange={(editor, data, value) => {
                        console.log(
                            editor.state.lint,
                            editor.state.lint.marked,
                            editor.state.lint.marked.length
                        );
                        debouncedUpdateTree(
                            setCssTree,
                            parse,
                            value,
                            setEditorErrors,
                            editor.state.lint.marked.length > 0
                        );
                        // setCssTree(parse(value));
                        // setEditorErrors(editor.state.lint.marked.length > 0);
                        // console.log(editor, data, parse(value));
                    }}
                />
            )}
        </div>
    );
};

export default Editor;
