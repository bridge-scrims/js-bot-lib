const TableRow = require("../postgresql/row");

const Position = require("./position");
const GuildProfile = require("./guild");

class PositionRole extends TableRow {

    static sortByLevel(a, b) {
        const getPosition = (e) => (e.position ?? { id_position: e.id_position });
        return Position.sortByLevel(getPosition(a), getPosition(b));
    }
    
    constructor(client, positionRoleData) {

        super(client, positionRoleData)

        /** @type {number} */
        this.id_position

        /** @type {Position} */
        this.position

        /** @type {string} */
        this.role_id

        /** @type {string} */
        this.guild_id

    }

    get position() {
        return this.client.positions.cache.find(this.id_position);
    }

    /**
     * @param {string|number|Object.<string, any>|Position} positionResolvable 
     */
    setPosition(positionResolvable) {
        if (typeof positionResolvable === "string") positionResolvable = { name: positionResolvable }
        this._setForeignObjectKeys(this.client.positions, ['id_position'], ['id_position'], positionResolvable)
        return this;
    }

    get role() {
        if (!this.role_id || !this.guild) return null;
        return this.guild.roles.resolve(this.role_id);
    }
    
    /**
     * @param {import('discord.js').RoleResolvable} roleResolvable 
     */
    setRole(roleResolvable) {
        this.role_id = roleResolvable?.id ?? roleResolvable
        return this;
    }

    get guild() {
        if (!this.bot || !this.guild_id) return null;
        return this.bot.guilds.resolve(this.guild_id);
    }

    get guildProfile() {
        return this.client.guilds.cache.find(this.guild_id);
    }

    /**
     * @param {string|GuildProfile|import("discord.js").BaseGuild} resolvable 
     */
    setGuild(resolvable) {
        this.guild_id = resolvable?.guild_id || resolvable?.id || resolvable
        return this;
    }

    /** 
     * @override
     * @param {Object.<string, any>} guildEntryData 
     */
    update(positionRoleData) {
        super.update(positionRoleData)
        this.setPosition(positionRoleData.position)
        return this;
    }

}

module.exports = PositionRole;