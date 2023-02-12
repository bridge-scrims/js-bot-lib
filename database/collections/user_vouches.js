const { StringSelectMenuBuilder, userMention } = require('discord.js');

const MessageOptionsBuilder = require('../../tools/payload_builder');
const LocalizedError = require('../../tools/localized_error');
const I18n = require('../../tools/internationalization');
const ColorUtil = require('../../tools/color_util');
const TextUtil = require('../../tools/text_util');

const Position = require('../position');


class ScrimsUserPositionVouchCollection {

    constructor(database, userId, positionResolvable) {

        Object.defineProperty(this, "client", { value: database })

        /** 
         * @readonly
         * @protected
         * @type {import('../../postgresql/database')} 
         */
        this.client

        /** 
         * @readonly
         * @type {string} 
         */
        this.userId = userId
        
        /** 
         * @protected
         * @type {import('../vouch')[]} 
         */
        this.vouches

        /** 
         * @readonly
         * @type {?number} 
         */
        this.id_position = null

        if (positionResolvable) {
            const pos = this.client.positions.cache.find(Position.resolve(positionResolvable))
            if (pos) this.id_position = pos.id_position
        }

    }

    get user() {
        return this.bot.users.resolve(this.userId) || this.client.users.cache.find(this.userId);
    }

    get bot() {
        return this.client.bot;
    }

    get position() {
        return this.client.positions.cache.find(this.id_position);
    }

    get size() {
        return this.get().length;
    }

    get ovw() {
        return this.get().reduce((pv, cv) => pv + cv.worth, 0) 
    }

    get() {
        return this.vouches.filter(v => !v.isExpired());
    }

    getExpired() {
        return this.vouches.filter(v => !v.isVoteOutcome() && v.isPositive() && v.isExpired());
    }

    getExposed() {
        return this.get().filter(v => !v.isHidden());
    }

    getPositive() {
        return this.get().filter(v => !v.isVoteOutcome() && v.isPositive());
    }

    getNegative() {
        return this.get().filter(v => !v.isVoteOutcome() && !v.isPositive());
    }

    getCovered() {
        const exposed = this.getExposed()
        return this.get().filter(v => !exposed.includes(v))
    }

    /**
     * @param {import('../vouch')[]|Object.<string, import('../vouch')[]>} [vouches] 
     */
    set(vouches) {
        if (vouches instanceof Array) vouches = vouches.filter(v => v.user_id === this.userId);
        else vouches = (vouches?.[this.userId] ?? []);

        this.vouches = vouches.filter(v => v.id_position === this.id_position).sort((a, b) => b.given_at - a.given_at)
        return this;
    }

    getSelector() {
        return { user_id: this.userId, id_position: this.id_position }
    }

    read() {
        return this.set(this.client.vouches.cache.get(this.getSelector()));
    }

    async fetch() {
        return this.set(await this.client.vouches.sqlFetch(this.getSelector()));
    }

    /**
     * @param {I18n} i18n 
     * @param {{ include_hidden?: boolean, include_expired?: boolean, only_hidden?: boolean }} [selectOptions]
     * @param {string} [guildId]
     * @param {boolean} [withIndex]
     */
    toMessage(i18n, { include_hidden, include_expired, only_hidden } = {}, guildId, withIndex = false) {
        const vouches = this.vouches
            .filter(v => (include_hidden || only_hidden || !v.isHidden()) && (include_expired || !v.isExpired()) && (!only_hidden || v.isHidden()))
        const color = ColorUtil.hsv2rgb(((120 / vouches.length) * vouches.filter(v => v.isPositive()).length) || 0, 1, 1)
        if (!include_expired && !include_hidden && !only_hidden && this.getExpired().length) 
            vouches.push(i18n.getObject("vouches.expired", this.getExpired().length))

        if (vouches.length === 0) return new MessageOptionsBuilder(
            new LocalizedError("vouches.none", userMention(this.userId), this.position?.name).toMessagePayload(i18n)
        );
        
        const councilRole = this.position?.getCouncil()?.getConnectedRoles(guildId)?.[0]
        const getField = (v, i) => v?.toEmbedField?.(i18n, councilRole, (withIndex ? (i+1) : null)) ?? v
        return new MessageOptionsBuilder()
            .createMultipleEmbeds(vouches, (vouches) => (
                i18n.getEmbed("vouches.embed_summary", { title: [this.position?.titleName] })
                    .setFields(...vouches.map(getField))
                    .setAuthor({ iconURL: this.user?.avatarURL(), name: `${this.user?.tag || 'Unknown User'} (${this.userId})` })
                    .setColor(color)
            ))
    }

    /**
     * @param {I18n} i18n 
     * @param {string} [guildId]
     */
    toRemoveMessage(i18n, guildId) {
        const message = this.toMessage(i18n, { include_expired: true, include_hidden: true }, guildId, true)
        const options = this.vouches
            .map((v, i) => ({ label: TextUtil.limitText(v.asString(i18n, i+1).replace(/\*/g, ''), 100, '...'), value: v.id_vouch }))
        
        Array.from(new Array(Math.ceil(options.length/25)).keys())
            .map((_, i) => options.slice(i*25, (i+1)*25))
            .map((options, i) => new StringSelectMenuBuilder().setCustomId(`REMOVE_VOUCH/${this.userId}/${i}`).setPlaceholder('Select to Remove').addOptions(options))
            .slice(0, 5).forEach(v => message.addActions(v))
        return message;
    }

}

module.exports = ScrimsUserPositionVouchCollection;