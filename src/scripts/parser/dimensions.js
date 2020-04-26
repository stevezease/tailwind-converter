import { convertUnit } from './unit-convert';

export const convertDimensions = (dimension, settings) => {
    if (dimension === 0 || dimension === '1px') {
        return dimension;
    }
    return convertUnit(dimensionArray, dimension, settings.remConversion);
};

const dimensionArray = [
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
