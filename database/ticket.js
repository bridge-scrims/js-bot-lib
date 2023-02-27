const { TextChannel, User } = require("discord.js");
const TableRow = require("../postgresql/row");

const TicketStatus = require("./ticket_status");
const UserProfile = require("./user_profile");
const GuildProfile = require("./guild");
const DBType = require("./type");

class Ticket extends TableRow {

    constructor(client, ticketData) {

        super(client, ticketData)

        /** @type {string} */
        this.id_ticket
        if (!this.id_ticket) this.setId()
        
        /** @type {string} */
        this.type

        /** @type {string} */
        this.user_id

        /** @type {string} */
        this.status

        /** @type {string} */
        this.guild_id

        /** @type {string} */
        this.channel_id 

        /** @type {number} */
        this.created_at
        if (!this.created_at) this.setCreation()

        /** @type {?string} */
        this.closer_id

        /** @type {?number} */
        this.deleted_at

    }

    isCacheExpired(now) {
        return ((this.status === "deleted") && (!now || super.isCacheExpired(now)));
    }

    /**
     * @param {string} [id_ticket] if falsely will use a random uuid
     */
    setId(id_ticket) {
        this.id_ticket = id_ticket ?? this.client.generateUUID()
        return this;
    }

    /** 
     * @param {import('discord.js').ChannelResolvable} channelResolvable 
     */
    setChannel(channelResolvable) {
        this.channel_id = channelResolvable?.id ?? channelResolvable
        return this;
    }

    /**
     * @param {number} [created_at] if falsely will use current time 
     */
    setCreation(created_at) {
        this.created_at = created_at ?? Math.floor(Date.now()/1000)
        return this;
    }

    /** @returns {TextChannel} */
    get channel() {
        if (!this.channel_id || !this.bot) return null;
        return this.bot.channels.resolve(this.channel_id);
    }

    /** @returns {Promise<TextChannel>} */
    async fetchChannel() {
        if (!this.guild) return null;
        return this.guild.channels.fetch(this.channel_id).catch(() => null);
    }

    getUserMention(format=true) {
        if (!this.userProfile) return (format ? "*unknown*" : "unknown");
        return this.userProfile.getMention(...arguments);
    }

    /** @param {'support'|'report'|'prime_app'} type */
    setType(type) {
        this.type = type
        return this;
    }

    /** @param {'open'|'closed'|'deleted'} status */
    setStatus(status) {
        this.status = status
        return this;
    }

    get userProfile() {
        return this.client.users.cache.find(this.user_id) || UserProfile.resolve(this.user);
    }

    get user() {
        if (!this.bot) return null;
        return this.bot.users.resolve(this.user_id);
    }

    /** @param {string|import('./user_profile')|User} user */
    setUser(user) {
        this.user_id = user?.user_id ?? user?.id ?? user
        return this;
    }

    get closerProfile() {
        return this.client.users.cache.find(this.closer_id);
    }

    get closer() {
        if (!this.bot || !this.closer_id) return null;
        return this.bot.users.resolve(this.closer_id);
    }

    /** @param {string|import('./user_profile')|User} closer */
    setCloser(closer) {
        this.closer_id = closer?.user_id ?? closer?.id ?? closer
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
     * @param {?number} deleted_at If undefined will use the current time
     */
    setDeletion(deleted_at = Math.floor(Date.now()/1000)) {
        this.deleted_at = deleted_at 
        return this;
    }

}

module.exports = Ticket;