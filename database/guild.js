const { CDN } = require('@discordjs/rest');
const TableRow = require("../postgresql/row");

const CDN_BUILDER = new CDN()

class GuildProfile extends TableRow {

    /**
     * @param {import("discord.js").Guild} guild 
     */
    static fromDiscordGuild(guild) {
        return new GuildProfile(guild.client.database, { guild_id: guild.id, name: guild.name, icon: (guild.icon ?? null) });
    }

    constructor(client, guildData) {

        super(client, guildData);

        /** @type {string} */
        this.guild_id

        /** @type {string} */
        this.name

        /** @type {string} */
        this.icon

    }

    iconURL() {
        if (!this.icon) return null;
        return CDN_BUILDER.icon(this.guild_id, this.icon);
    }

    get discord() {
        if (!this.guild_id || !this.bot) return null;
        return this.bot.guilds.resolve(this.guild_id);
    }

    /**
     * @param {string|GuildProfile|import("discord.js").BaseGuild} resolvable 
     */
    setGuild(resolvable) {
        this.guild_id = resolvable?.guild_id || resolvable?.id || resolvable
        return this;
    }

}

module.exports = GuildProfile;