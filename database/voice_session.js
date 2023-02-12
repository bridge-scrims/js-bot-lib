const TableRow = require("../postgresql/row");
const { User, Guild } = require("discord.js");
const UserProfile = require("./user_profile");

class VoiceChannelSession extends TableRow {

    constructor(client, sessionData) {

        super(client, sessionData)

        /** @type {string} */
        this.session_id

        /** @type {string} */
        this.guild_id

        /** @type {string} */
        this.channel_id

        /** @type {string} */
        this.user_id

        /** @type {number} */
        this.started_at

        /** @type {number} */
        this.ended_at

    }

    /** @param {string} session_id */
    setId(session_id) {
        this.session_id = session_id
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

    /** @returns {import("discord.js").VoiceBasedChannel} */
    get channel() {
        if (!this.guild || !this.channel_id) return null;
        return this.guild.channels.resolve(this.channel_id);
    }

    /** 
     * @param {import('discord.js').ChannelResolvable} channelResolvable 
     */
    setChannel(channelResolvable) {
        this.channel_id = channelResolvable?.id ?? channelResolvable
        return this;
    }

    get userProfile() {
        return this.client.users.cache.find(this.user_id) || UserProfile.resolve(this.user);
    }

    get user() {
        if (!this.bot || !this.user_id) return null;
        return this.bot.users.resolve(this.user_id);
    }

    /** @param {string|import('./user_profile')|User} user */
    setUser(user) {
        this.user_id = user?.user_id ?? user?.id ?? user
        return this;
    }

    /**
     * @param {?number} [started_at] If falsely will use current timestamp 
     */
    setStartPoint(started_at) {
        this.started_at = started_at || Math.floor(Date.now()/1000)
        return this;
    }

    /**
     * @param {?number} ended_at If undefined will use current timestamp 
     */
    setEndPoint(ended_at = Math.floor(Date.now()/1000)) {
        this.ended_at = ended_at 
        return this;
    }

}

module.exports = VoiceChannelSession;