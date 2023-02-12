const GuildEntry = require("../database/guild_entry")

/**
 * @template T
 * @callback createCall
 * @param {GuildEntry} entry
 * @param {T} existing
 * @returns {Promise<T>}
 */

/**
 * @template T
 * @callback removeCall
 * @param {T} obj
 */

/** @template T */
class DynamicallyConfiguredObjectCollection {

    /**
     * @param {import("../postgresql/database")} database 
     * @param {string} type 
     * @param {createCall<T>} createCall 
     * @param {removeCall<T>} removeCall 
     */
    constructor(database, type, createCall, removeCall) {

        this.database = database
        this.type = type

        /** @protected */
        this.createCall = createCall

        /** @protected */
        this.removeCall = removeCall

        /** 
         * @protected
         * @readonly
         * @type {{ [x: string]: T }} 
         */
        this.created = {}

        this.database.call('ensure_type', [`${this.database.guildEntryTypes}`, type]).catch(console.error)

        this.database.guildEntries.cache.on('push', (...a) => this.onCacheCreate(...a).catch(console.error))
        this.database.guildEntries.cache.on('update', (...a) => this.onCacheCreate(...a).catch(console.error))
        this.database.guildEntries.cache.on('remove', (...a) => this.onCacheRemove(...a).catch(console.error))
        
        const configured = this.database.guildEntries.cache.values().filter((...a) => this.isCorrectHandler(...a))
        Promise.allSettled(configured.map(e => this.onCacheCreate(e).catch(console.error)))

    }

    get bot() {
        return this.database.bot
    }

    values() {
        return Object.values(this.created)
    }
    
    /** 
     * @param {string} guildId
     */
    get(guildId) {
        return this.created[guildId];
    }

    /** 
     * @protected
     * @param {GuildEntry} entry 
     */
    isCorrectHandler(entry) {
        if (this.bot) {
            if (!this.bot.guilds.cache.has(entry.guild_id)) return false;
            if (entry.client_id && this.bot.user.id !== entry.client_id) return false;
            if (
                !entry.client_id && this.database.guildEntries.cache.find({ 
                    client_id: this.bot.user.id, id_type: entry.id_type, guild_id: entry.guild_id 
                })
            ) return false;
        }
        return (entry.type.name === this.type)
    }

    /** 
     * @protected
     * @param {GuildEntry} entry 
     */
    async onCacheCreate(entry) {
        if (this.isCorrectHandler(entry)) {
            this.onCacheRemove(entry)
            this.created[entry.guild_id] = await this.createCall(entry, this.created[entry.guild_id])
        }
    }

    remove(guildId) {
        if (guildId in this.created) {
            this.removeCall(this.created[guildId])
            delete this.created[guildId]
        }
    }

    /** 
     * @protected
     * @param {GuildEntry} entry 
     */
    async onCacheRemove(entry) {
        if (this.isCorrectHandler(entry)) {
            this.remove(entry.guild_id)
        }
    }

}

module.exports = DynamicallyConfiguredObjectCollection;