const TableRow = require("../postgresql/row");

const GuildProfile = require("./guild");
const DBType = require("./type");

const NONE = 0;

class GuildEntry extends TableRow {

    constructor(client, entryData) {

        super(client, entryData);

        /** @type {string} */
        this.guild_id

        /** @type {number} */
        this.id_type

        /** @type {?string} */
        this.client_id
 
        /** @type {string} */
        this.value

    }

    /** @param {?string} client_id */
    setClient(client_id) {
        this.client_id = client_id
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

    get type() {
        return this.client.guildEntryTypes.cache.find(this.id_type);
    }

    /**
     * @param {number|string|Object.<string, any>|DBType} statusResolvable 
     */
    setType(typeResolvable) {
        if (typeof typeResolvable === "string") typeResolvable = { name: typeResolvable }
        this._setForeignObjectKeys(this.client.guildEntryTypes, ['id_type'], ['id_type'], typeResolvable)
        return this;
    }

    /**
     * @param {string} value 
     */
    setValue(value) {
        this.value = value
        return this;
    }

    /** 
     * @override
     * @param {Object.<string, any>} guildEntryData 
     */
    update(guildEntryData) {
        const client_id = (guildEntryData.client_id === NONE ? null : guildEntryData.client_id)
        super.update({ ...guildEntryData, client_id })
        this.setType(guildEntryData.type)
        return this;
    }

    /** @override */
    toSQLData() {
        const data = super.toSQLData()
        if (data.client_id === null) data.client_id = NONE
        return data;
    }

}

module.exports = GuildEntry;