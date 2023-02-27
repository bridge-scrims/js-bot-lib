const { default: parseDuration } = require("parse-duration");
const util = require('util');

class TextUtil {

    static parseDuration(input) {
        return parseDuration(input);
    }
    
    /** @param {string} text */
    static stripText(text, charLimit=Infinity) {
        while (text.includes("\n\n\n")) 
            text = text.replace("\n\n\n", "\n\n");

        const lines = text.split("\n").map(v => v.trim())
        if (lines.length > 10)
            text = lines.slice(0, lines.length-(lines.length-10)).join("\n") + lines.slice(lines.length-(lines.length-10)).map(v => v.trim()).join(" ")
        
        text = text.trim()
        if (text.length > charLimit) text = text.slice(0, charLimit-12) + " ...and more"
        return text;
    }

    /** @param {string} text */
    static limitText(text, charLimit, hint=" ...and more") {
        if (text.length > charLimit) return text.slice(0, charLimit-hint.length) + hint;
        return text;
    }

    /** @param {Array.<string>} arr */
    static reduceArray(arr, charLimit, start="") {
        const and_more = (i) => `\n*...and ${arr.length - i} more*`;
        return arr.reduce(([pv, am], cv, i) => {
            const val = pv + "\n" + cv
            if ((val.length + and_more(i).length) > charLimit) return [pv, am || and_more(i)];
            return [val, am];
        }, [start, ""]).join('')
    }

    /** @param {number} delta Number of seconds to stringify */
    static stringifyTimeDelta(delta, withoutFormatting=false) {
        const layers = { day: 86400, hour: 3600, min: 60 };
        const timeLeft = { day: 0, hour: 0, min: 0 };
        if (delta < 60) return (withoutFormatting ? "1min" : `\`1min\``);
    
        for (const [layer, value] of Object.entries(layers)) {
            const amount = Math.floor(delta / value)
            if (amount < 1) continue;
            delta -= (amount * value)
            timeLeft[layer] += amount
        }
        
        return Object.entries(timeLeft)
            .filter(([name, value]) => (value > 0))
            .map(([name, value]) => `${value}${(value > 1 ? `${name}s` : name)}`)
            .map(v => (withoutFormatting ? v : `\`${v}\``))
            .join(' ');
    }

    /** @param {any[]} array */
    static stringifyArray(array) {
        return [array.slice(0, -1).join(', '), array.slice(-1)[0]].filter(v => v).join(' and ');
    }

    /**
     * @typedef StringFormatOptions
     * @property {string} [unknownCase] What to return if any params are falsely
     */

    /** 
     * @param {string} string 
     * @param {any} params
     * @param {StringFormatOptions}
     */
    static format(string, params, { unknownCase } = {}) {
        params = [params].flat()
        if (params.some(v => !v)) return unknownCase ?? "";
        return util.format(string, ...params);
    }

    /** @param {string} string  */
    static isValidHttpUrl(string) {
        return (() => {
            try {
                return new URL(string);
            } catch (_) {
                return false;  
            }
        })()?.protocol === "https:";
    }

    /** @param {string} str  */
    static snakeToUpperCamelCase(str) {
        return str.split("_").map(v => v[0].toUpperCase() + v.slice(1)).join(" ");
    }

    /** @param {string} str  */
    static snakeToNormalCase(str) {
        return str.replaceAll('_', ' ');
    }

    static stringifyObject(obj, max) {
        if (!obj || Object.values(obj).length < 1) return '*None*';
        if (obj instanceof Array)
            return obj.slice(0, max).map(value => '`•` ' + `${value}`).join('\n') + (obj.length > max ? `\n... and more` : ``);
        return Object.entries(obj).slice(0, max).map(([key, value]) => `\`•\` **${key}:** \`${value}\``).join('\n') 
            + (Object.keys(obj).length > max ? `\n... and more` : ``);
    }

}

module.exports = TextUtil;