const { Guild, GuildMember } = require("discord.js");
const { default: parseDuration } = require("parse-duration");
const util = require('util');

class TextUtil {

    /**
     * @param {string} resolvable 
     * @param {import('../database/user_profile')[]} profiles 
     * @param {Guild} guild 
     * @returns {import('../database/user_profile')|GuildMember|null}
     */
    static parseUser(resolvable, profiles, guild) {
        resolvable = resolvable.replace(/```|:|\n|@/g, '')
        const dbMatches = profiles.filter(user => [user.user_id, user.tag, user.username].includes(resolvable))
        if (dbMatches.length === 1) return dbMatches[0];

        if (guild) {
            const members = Array.from(guild.members.cache.values())
            const displayNameMatches = members.filter(user => user.displayName === resolvable)
            if (displayNameMatches.length === 1) return displayNameMatches[0].user;

            const tagMatches = members.filter(m => m.user.tag === resolvable)
            if (tagMatches.length === 1) return tagMatches[0].user;
        }

        const caselessDBMatches = profiles.filter(user => (
            [user.user_id, user.tag, user.username]
                .filter(v => v).map(v => v.toLowerCase()).includes(resolvable.toLowerCase())
        ))
        if (caselessDBMatches.length === 1) return caselessDBMatches[0];
        return null;
    }

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
        const AND_MORE = "\n ...and more" 
        return arr.reduce((pv, cv) => {
            const val = pv + "\n" + cv
            if ((val.length + AND_MORE.length) > charLimit) return pv;
            return val;
        }, start)
    }

    /** @param {number} delta Number of seconds to stringify */
    static stringifyTimeDelta(delta, withoutFormating=false) {
        const layers = { day: 86400, hour: 3600, min: 60 };
        const timeLeft = { day: 0, hour: 0, min: 0 };
        if (delta < 60) return (withoutFormating ? "1min" : `\`1min\``);
    
        for (const [layer, value] of Object.entries(layers)) {
            const amount = Math.floor(delta / value)
            if (amount < 1) continue;
            delta -= (amount * value)
            timeLeft[layer] += amount
        }
        
        return Object.entries(timeLeft)
            .filter(([name, value]) => (value > 0))
            .map(([name, value]) => `${value}${(value > 1 ? `${name}s` : name)}`)
            .map(v => (withoutFormating ? v : `\`${v}\``))
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

}

module.exports = TextUtil;