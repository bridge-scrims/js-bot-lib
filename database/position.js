const NamedRow = require("./named_row");

const RANKS = ['prime', 'private', 'premium']

/**
 * @typedef {string | number | Position} PositionResolvable
 */

class Position extends NamedRow {

    static sortByLevel(a, b) {
        const getWorth = (e) => (((e.level ?? undefined) < 100) ? e.level : (e.name.length*1000));
        return (getWorth(a) - getWorth(b)) || (a.id_position - b.id_position);
    }

    /** @param {PositionResolvable} resolvable */
    static resolve(resolvable) {
        return (v) => (v === resolvable || v.id_position === resolvable || v.name === resolvable);
    }

    constructor(client, positionData) {

        super(client, positionData);

        /** @type {number} */
        this.id_position

        /** @type {boolean} */
        this.sticky

        /** @type {?number} */
        this.level

    }
    
    get managed() {
        return this.name === "banned";
    }

    get dontLog() {
        return this.name === "bridge_scrims_member";
    }

    get hexColor() {
        return this.bot?.host?.getPositionRequiredRoles(this)?.[0]?.hexColor ?? "#FFFFFF";
    }

    hasLevel() {
        return (typeof this.level === "number");
    }

    /**
     * @param {boolean} sticky 
     */
    setSticky(sticky) {
        this.sticky = sticky
        return this;
    }

    /**
     * @param {number} level 
     */
    setLevel(level) {
        this.level = level
        return this;
    }

    /** @returns {import('discord.js').Role[]} */
    getConnectedRoles(guild_id) {
        return this.client.positionRoles.cache.get({ id_position: this.id_position, guild_id })
            .map(posRole => posRole.role).filter(v => v);
    }

    isRank() {
        return RANKS.includes(this.name);
    }

    isRankLevel(name) {
        const idxa = RANKS.indexOf(this.name)
        const idxb = RANKS.indexOf(name)
        return !(idxa === -1 || idxb === -1) && (idxa >= idxb);
    }

    getPositionLevelPositions() {
       if (!this.hasLevel()) return [ this ];
       return this.client.positions.cache.filter(pos => pos.hasLevel() && (pos.level <= this.level));
    }

    asUserInfo(guild_id, symbol = ':small_orange_diamond:') {
        const connectivity = ((guild_id && this.getConnectedRoles(guild_id).length > 0) ? (" **⇨** " + this.getConnectedRoles(guild_id).join(" ")) : "")
        return `${symbol}  **${this.titleName}** (${this.id_position})${connectivity}`;
    }

    getCouncil() {
        if (!this.isRank()) return null;
        return this.client.positions.cache.find(Position.resolve(`${this.name}_council`));
    }
    
}

module.exports = Position;