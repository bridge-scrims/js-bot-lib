const { Events, BaseGuild } = require("discord.js")
const DBGuild = require("../database/guild")

class DBGuildUpdater {

    constructor(bot) {

        Object.defineProperty(this, 'bot', { value: bot })
        
        /**
         * @type {import("./bot")}
         * @readonly
         */
        this.bot

        this.bot.on('ready', () => this.__addEventListeners())

    }

    get database() {
        return this.bot.database;
    }

    __addEventListeners() {
        this.bot.on(Events.GuildCreate, guild => this.update(guild).catch(console.error))
        this.bot.on(Events.GuildUpdate, (_, guild) => this.update(guild).catch(console.error))
    }

    /** @param {BaseGuild} guild */
    async update(guild) {

        const existing = this.database.guilds.cache.resolve(guild.id)
        if (!existing) {
            return this.database.guilds.create(DBGuild.fromDiscordGuild(guild))
                .catch(error => console.error(`Unable to create guild profile because of ${error}!`));
        }

        if (existing?.name !== guild.name || existing?.icon !== guild.icon) {
            await this.database.guilds.update({ guild_id: guild.id }, { name: guild.name, icon: guild.icon })
                .catch(error => console.error(`Unable to update guild profile because of ${error}!`))
        }

    }

    /** @param {BaseGuild[]} guilds */
    async initialize(guilds) {

        console.log("Initializing guilds...")
        await Promise.all(guilds.map(guild => this.update(guild).catch(console.error)))
        console.log("Guilds initialized!")

    }

}

module.exports = DBGuildUpdater;