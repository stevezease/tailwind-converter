import { convertUnit } from './unit-convert';

export const convertSpacing = (
    property,
    spacing,
    tailWindStyles,
    errors,
    settings
) => {
    if (!settings.autoConvertSpacing) {
        return spacing;
    }
    if (
        (property === 'padding' || property === 'margin') &&
        spacing === '1px'
    ) {
        return spacing;
    }
    if (
        ['-1px', 'auto'].indexOf(spacing) !== -1 &&
        [
            'margin',
            'margin-left',
            'margin-right',
            'margin-top',
            'margin-bottom',
        ].indexOf(property) !== -1
    ) {
        return spacing;
    }
    const dimensions = spacing.split(' ');
    const remArray = property.startsWith('padding')
        ? paddingArray
        : marginArray;
    if (dimensions.length === 1) {
        return convertUnit(remArray, dimensions[0], settings.remConversion);
    }
    //cannot handle short hands
    return spacing;
};

const paddingArray = [
    0,
    0.25,
    0.5,
    0.75,
    1,
    1.25,
    1.5,
    2,
    2.5,
    3,
    4,
    5,
    6,
    8,
    10,
    12,
    14,
    16,
];
const marginArray = [
    -0.25,
    -0.5,
    -0.75,
    -1,
    -1.25,
    -1.5,
    -2,
    -2.5,
    -3,
    -4,
    -5,
    -6,
    -8,
    -10,
    -12,
    -14,
    -16,
    0,
    0.25,
    0.5,
    0.75,
    1,
    1.25,
    1.5,
    2,
    2.5,
    3,
    4,
    5,
    6,
    8,
    10,
    12,
    14,
    16,
];
