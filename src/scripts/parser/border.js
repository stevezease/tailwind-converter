import { convertUnit } from './unit-convert';

export const convertBorderRadius = (borderRadius, settings) => {
    return convertUnit(borderRadiusArray, borderRadius, settings.remConversion);
};

const borderRadiusArray = [0, 0.125, 0.25, 0.375, 0.5];
