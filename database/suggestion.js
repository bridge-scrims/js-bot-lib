const { EmbedBuilder, userMention, time } = require("discord.js");
const TableRow = require("../postgresql/row");

const { userAsEmbedAuthor } = require("../tools/discord_util");
const ScrimsMessageBuilder = require("../tools/responses");
const { Colors } = require("../tools/constants");
const TextUtil = require("../tools/text_util");

const GuildProfile = require("./guild");


class Suggestion extends TableRow {

    constructor(client, suggestionData) {

        super(client, suggestionData)

        /** @type {string} */
        this.id_suggestion
        if (!this.id_suggestion) this.setId()
        
        /** @type {string} */
        this.guild_id

        /** @type {string} */
        this.channel_id

        /** @type {string} */
        this.message_id

        /** @type {number} */
        this.created_at

        /** @type {string} */
        this.creator_id

        /** @type {?number} */
        this.epic

        /** @type {?string} */
        this.image_url

        /** @type {?boolean} */
        this.identified

    }

    /** @returns {?import("discord.js").TextBasedChannel} */
    get channel() {
        if (!this.guild || !this.channel_id) return null;
        return this.guild.channels.resolve(this.channel_id);
    }

    /** @returns {?import("discord.js").Message<true>} */
    get message() {
        if (!this.channel || !this.message_id) return null;
        return this.channel.messages.resolve(this.message_id);
    }

    async fetchMessage() {
        if (!this.channel || !this.message_id) return null;
        return this.channel.messages.fetch(this.message_id);
    }

    isCacheExpired(now) {
        return ((now - this.created_at) > (5*24*60*60)) && super.isCacheExpired(now);
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
     * @param {import('discord.js').MessageResolvable} messageResolvable 
     */
    setMessage(messageResolvable) {
        this.message_id = messageResolvable?.id ?? messageResolvable
        return this;
    }

    /**
     * @param {number} [created_at] if falsely will use current time 
     */
    setCreation(created_at) {
        this.created_at = created_at ?? Math.floor(Date.now()/1000)
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

    get creatorProfile() {
        return this.client.users.cache.find(this.creator_id);
    }

    get creator() {
        if (!this.bot || !this.creator_id) return null;
        return this.bot.users.resolve(this.creator_id);
    }

    /**
     * @param {import("discord.js").GuildResolvable} guildResolvable 
     */
    getCreatorMember(guildResolvable) {
        if (!this.bot || !this.creator_id) return null;
        return this.bot.guilds.resolve(guildResolvable)?.members?.resolve(this.creator_id) || null;
    }

    /** 
     * @param {string|import('./user_profile')|import('discord.js').User} creator 
     */
    setCreator(creator) {
        this.creator_id = creator?.user_id ?? creator?.id ?? creator
        return this;
    }

    /**
     * @param {number} [epic] if falsely will use current time 
     */
    setEpic(epic) {
        this.epic = epic ?? Math.floor(Date.now()/1000)
        return this;
    }

    /** 
     * @param {?string} url 
     */
    setImageURL(url) {
        this.image_url = url
        return this;
    }

    /** @param {boolean} identified */
    setIdentified(identified) {
        this.identified = identified
        return this;
    }

    /**
     * @typedef {SuggestionOptions|import('discord.js').Message} SuggestionOptionsResolvable
     * @typedef SuggestionOptions
     * @prop {string} title
     * @prop {string} idea
     * @prop {number} [idx]
     */

    /** 
     * @param {SuggestionOptionsResolvable} [resolvable]
     */
    resolveEmbedOptions(resolvable) {
        /** @type {?import('discord.js').Embed} */
        const old = (resolvable || this.message)?.embeds?.[0]

        /** @type {?SuggestionOptions} */
        const options = resolvable

        const author = userAsEmbedAuthor(this.getCreatorMember(this.guild_id) || this.creator) || this.creatorProfile?.toEmbedAuthor()
        return { 
            title: (options?.title || old?.title || null),
            idea: (options?.idea || old?.description || 'Unknown Suggestion'),
            author: (this.identified ? (author || old?.author) : (this.identified === null ? old?.author : null)) || null, 
            footer: (old?.footer || null), idx: options?.idx
        }
    }

    /** 
     * @param {SuggestionOptionsResolvable} [resolvable]
     * Where hue = 120 is green and hue = 0 is red and hue < 0 means purple 
     */
    toEmbed(resolvable, hue = 60) {
        const options = this.resolveEmbedOptions(resolvable)
        const embed = new EmbedBuilder()
            .setColor((hue < 0 ? Colors.Barney : ScrimsMessageBuilder.hsv2rgb(hue, 1, 1)))
            .setImage(this.image_url)
            .setTitle(options.title)
            .setDescription(options.idea)
            .setFooter(options.footer)
            .setAuthor(options.author)
        if (options.idx) embed.setFooter({ text: `Suggestion #${options.idx}` })
        return embed;
    }

    /** 
     * @param {SuggestionOptionsResolvable} [resolvable]
     */
    toEmbedField(resolvable) {
        const options = this.resolveEmbedOptions(resolvable)
        const info = `**Created by ${userMention(this.creator_id)} on ${time(this.created_at, "F")}**`
        const msg = TextUtil.limitText(options.idea, 1024 - info.length - 8, "\n...")
        return ({
            name: options.title || 'Suggestion',
            value: `${info}\n\`\`\`\n${msg}\`\`\``,
            inline: false
        })
    }

}

module.exports = Suggestion;