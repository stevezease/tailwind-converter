import { convertUnit } from './unit-convert';

export const convertFontWeight = (fontWeight) => {
    switch (fontWeight) {
        case 'normal':
            return 400;
        case 'bold':
            return 700;
        default:
            return fontWeight;
    }
};

export const convertFontSize = (fontSize, settings) => {
    return convertUnit(fontSizeArray, fontSize, settings.remConversion, true);
};

export const convertLineHeight = (lineHeight, settings) => {
    return convertUnit(
        lineHeightArray,
        lineHeight,
        settings.remConversion,
        true
    );
};

const fontSizeArray = [
    0.75,
    0.875,
    1,
    1.125,
    1.25,
    1.5,
    1.875,
    2.25,
    2.5,
    3,
    4,
];

const lineHeightArray = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5];
