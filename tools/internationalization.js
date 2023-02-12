const fs = require('fs');

const path = require('path');
const { EmbedBuilder } = require('discord.js');
const MessageOptionsBuilder = require('./payload_builder');

const LANG_DIR = path.join('src', 'assets', 'lang');

const DEFAULT_LOCALE = "en-US"
const UNKNOWN_RESOURCE = "UNKNOWN_RESOURCE"

/** 
 * Resource identifiers should be in **snake_case** (all lowercase & underscores).
 * - **.** Represents a new depth in the language file.
 * - **-/+** At the start of a identifier means that the resource should be returned in all lowercase/uppercase.
 * - **${resource_id}** Indicates that a different resource should be inserted.
 * - **§{0-∞}** Indicates that a parameter with a certain index should be inserted.
 * - **?(...)** Indicates that anything in the brackets should be discarded if anything unknown comes up.
 */
class I18n {

    /** @type {Object.<string, I18n>} */
    static instances = {};

    /**
     * @param {string} locale 
     * @returns {I18n}
     */
    static getInstance(locale=DEFAULT_LOCALE) {
        return this.instances[locale] ?? this.instances[DEFAULT_LOCALE];
    }

    static getLocalizations(identifier, ...params) {
        return Object.fromEntries(
            Object.entries(this.instances)
                .map(([_, i18n]) => [_, i18n.get(identifier, ...params)])
                .filter(([_, v]) => v !== UNKNOWN_RESOURCE)
        );
    }

    constructor(resources) {

        Object.defineProperty(this, "resources", { value: resources })

        /** 
         * @protected
         * @type {Object.<string, string|import('discord.js').MessageEmbedOptions>} 
         * @readonly
         */
        this.resources

    }

    /**
     * @param {string} resourceId 
     * @returns {string}
     */
    get(resourceId, ...params) {
        return this._get(resourceId, params, true)
    }

    /** @param {string} resourceId */
    has(resourceId) {
        return (this._get(resourceId, [], false) !== UNKNOWN_RESOURCE);
    }

    /** @param {string} resourceId */
    hasString(resourceId) {
        return (this._get(resourceId, [], true) !== UNKNOWN_RESOURCE);
    }

    /** @param {string} resourceId */
    getMixed(resourceId, ...params) {
        const val = this._get(resourceId, params, false)
        if (typeof val === "string") return val;
        return this.getEmbed(resourceId, ...params);
    }

    /** 
     * @param {string} resourceId 
     * @returns {MessageOptionsBuilder}
     */
    getMessageOptions(resourceId, ...params) {
        const val = this.getMixed(resourceId, ...params)
        if (val instanceof EmbedBuilder) return new MessageOptionsBuilder().addEmbeds(val).removeMentions();
        if (typeof val !== "string") return new MessageOptionsBuilder().setContent(UNKNOWN_RESOURCE).removeMentions();
        return new MessageOptionsBuilder().setContent(val).removeMentions();
    }

    /**
     * @param {string} identifier 
     * @param {string[]|[Object.<string, string[]]|[Array.<string>]} [params]
     */
    getEmbed(identifier, ...params) {
        if (!params) params = []
        if (params.length === 1 && (typeof params[0] === "object")) params = params[0]
        else params = { description: params }

        const value = this._get(identifier, (params?.description ?? []), false)
        if (typeof value === "string") return new EmbedBuilder().setDescription(value);
        return new EmbedBuilder(this.formatObject(value, params));
    }

    /**
     * @param {string} identifier 
     * @param {string[]|[Object.<string, string[]>]} [params]
     */
    getObject(identifier, ...params) {
 
        if (!params) params = []
        if (params.length === 1 && (typeof params[0] === "object")) params = params[0]

        const value = this._get(identifier, [], false)
        if (typeof value === "string") return {};
        return this.formatObject(value, params);

    }

    /** 
     * @protected
     * @param {string} identifier 
     * @param {any[]} params Are inserted into the resource
     */
    _get(identifier, params, forceString=false) {

        const toLower = identifier.startsWith("-")
        const toUpper = identifier.startsWith("+")
        const args = ((toLower || toUpper) ? identifier.slice(1) : identifier).split(".").filter(v => v)

        const val = args.reduce((pv, cv) => pv?.[cv], this.resources)
        if (typeof val !== "string" && forceString) return UNKNOWN_RESOURCE;
        if (typeof val === "string") return this.formatString((toLower ? val.toLowerCase() : (toUpper ? val.toUpperCase() : val)), params);
        return val ?? UNKNOWN_RESOURCE;
        
    }

    /** 
     * @protected 
     * @returns {Object.<string, any>}
     */
    formatObject(obj, params={}) {
        const getParams = (key) => (params instanceof Array) ? params : params[key];
        return Object.fromEntries(
            Object.entries(obj)
                .map(([key, val]) => [key, ((typeof val === "object") ? this.formatObject(val, getParams(key)) : this.formatString(val, getParams(key)))])
        )
    }

    /** 
     * @protected 
     * @param {string} string
     */
    formatString(string, params=[]) {
        /** @param {string} str */
        const format = (str) => {
            const refReplaces = Array.from(str.matchAll(/(?<!\\)(?:\\\\)*\${(.+?)(?<!\\)(?:\\\\)*}/g)).map(([m, id]) => [m, this._get(id, params, true)])
            const idxReplaces = Array.from(str.matchAll(/(?<!\\)(?:\\\\)*§{(\d+)(?<!\\)(?:\\\\)*}/g)).map(([m, i]) => [m, params[parseInt(i)] ?? UNKNOWN_RESOURCE])
            const orderedReplaces = Array.from(str.matchAll(/(?<!\\)(?:\\\\)*%s/g)).map(([m], i) => [m, params[i] ?? UNKNOWN_RESOURCE])
            const replaces = [ ...orderedReplaces, ...refReplaces, ...idxReplaces ]
            replaces.forEach(([m, r]) => str = str.replace(m, (r === UNKNOWN_RESOURCE) ? "unknown" : r))
            return { replaces, missing: replaces.some(([_, r]) => r === UNKNOWN_RESOURCE), v: str }
        }

        Array.from(string.matchAll(/(?<!\\)(?:\\\\)*\?\((.+?)(?<!\\)(?:\\\\)*\)/g))
            .map(([m, content]) => [m, format(content)])
            .forEach(([m, { v, missing }]) => string = string.replace(m, (missing ? "" : v)))

        return format(string).v;
    }

}

function loadLocal(fileName) {
    const content = fs.readFileSync(path.join(LANG_DIR, fileName), { encoding: 'utf8' })
    const localName = fileName.slice(0, -5)
    I18n.instances[localName] = new I18n(JSON.parse(content))
}

const files = fs.readdirSync(LANG_DIR)
files.forEach(fileName => loadLocal(fileName))
if (!I18n.getInstance()) throw new Error(`A default locale is required!`)

module.exports = I18n;