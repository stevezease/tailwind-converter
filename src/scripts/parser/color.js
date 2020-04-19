import { Colors } from '../constants';
import NearestColor from 'nearest-color';

export const convertColor = (color, settings) => {
    if (!settings.autoConvertColor || !isColor(color)) {
        return color;
    }
    try {
        return NearestColor.from(Colors)(color);
    } catch (e) {
        console.error('error converting color', e);
        return color;
    }
};

// Only checks names and Hexes - Need to improve
export const isColor = (strColor) => {
    var s = new Option().style;
    s.color = strColor;
    var test1 = s.color == strColor;
    var test2 = /^#[0-9A-F]{6}$/i.test(strColor);
    if (test1 == true || test2 == true) {
        return true;
    } else {
        return false;
    }
};
