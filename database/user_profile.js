const { User, Guild, EmbedBuilder, GuildMember } = require("discord.js");
const { CDN } = require('@discordjs/rest');

const { Colors } = require("../tools/constants");
const TableRow = require("../postgresql/row");
const moment = require("moment-timezone");
const UserPermissionsCollection = require("./collections/user_permissions");
const PermissionData = require("./permission_data");

/**
 * @typedef {string|UserProfile|User} UserResolvable
 */

const CDN_BUILDER = new CDN()
class UserProfile extends TableRow {

    /** @param {?User} user */
    static fromUser(user) {
        if (!user) return null;
        return new UserProfile(user.client.database).setDiscord(user)
    }

    /** @param {User|GuildMember|null} resolvable */
    static resolve(resolvable) {
        if (!resolvable) return null;
        const user = (resolvable instanceof GuildMember) ? resolvable.user : resolvable
        return new UserProfile(resolvable.client.database).setDiscord(user)
    }

    constructor(client, profileData) {

        super(client, profileData)

        /** @type {string} */
        this.user_id

        /** @type {number} */
        this.joined_at

        /** @type {string} */
        this.username

        /** @type {string} */
        this.discriminator

        /** @type {?number} */
        this.accent_color

        /** @type {?string} */
        this.avatar

        /** @type {?string} */
        this.country

        /** @type {?string} */
        this.timezone

    }

    get user() {
        if (!this.bot || !this.user_id) return null;
        return this.bot.users.resolve(this.user_id);
    }

    get tag() {
        return `${this.username}#${`${this.discriminator}`.padStart(4, '0')}`;
    }

    get mention() {
        if (!this.user_id) return undefined;
        return `<@${this.user_id}>`;
    }

    toString() {
        return this.mention ?? `*Unknown User*`;
    }

    isClient() {
        return this.bot?.user?.id === this.user_id;
    }

    /** @param {string} user_id */
    setId(user_id) {
        this.user_id = user_id
        return this;
    }

    /** @param {number} [joined_at] if falsely will use the current time */
    setJoinPoint(joined_at) {
        this.joined_at = joined_at ?? Math.floor(Date.now()/1000)
        return this;
    }

    /** @param {string|number} discriminator */
    setDiscriminator(discriminator) {
        if (typeof discriminator === 'string') discriminator = parseInt(discriminator)
        this.discriminator = discriminator
        return this;
    }

    /** @param {string} avatar */
    setAvatar(avatar) {
        this.avatar = avatar
        return this;
    }

    /** 
     * ***Force fetch the user first!***
     * @param {User} user 
     */
    setDiscord(user) {
        this.user_id = user.id
        this.username = user.username
        this.setDiscriminator(user.discriminator)
        this.accent_color = user.accentColor ?? null
        this.setAvatar(user.avatar ?? null)
        return this;
    }

    /** @param {string} country */
    setCountry(country) {
        this.country = country
        return this;
    }

    /** @param {string} timezone */
    setTimezone(timezone) {
        this.timezone = timezone
        return this;
    }

    getMention(format=true, guild=false) {
        if (this.user && (!guild || this.getMember(guild))) return `${this.user}`;
        if (this.tag) return (format? `**@${this.tag}**` : `@${this.tag}`);
        return (format ? "*unknown*" : "unknown");
    }

    getCurrentTime() {
        if (!this.timezone) return null;
        return moment.tz(moment(), this.timezone);        
    }

    /** @param {Guild} [guild] */
    getMember(guild) {
        if (!guild || !this.user_id) return null;
        return guild.members.cache.get(this.user_id) ?? null;
    }

    getUTCOffset() {
        if (!this.timezone) return null;
        const seconds = moment.parseZone(this.timezone)?.utcOffset()
        if (!seconds) return null;
        const hours = `${Math.floor(Math.abs(seconds)/60)}`.padStart(2, '0')
        const minutes = `${Math.round(Math.abs(seconds)%60)}`.padEnd(2, '0')
        return `${(seconds < 0) ? '-' : '+'}${hours}:${minutes}`
    }

    async fetchPermissions() {
        return (new UserPermissionsCollection(this.client, this.user_id)).fetch();
    }

    /** @param {PermissionData|UserPermissionsCollection} permissions */
    getPermissions(permissions) {
        if (permissions instanceof UserPermissionsCollection) return permissions;
        return (new UserPermissionsCollection(this.client, this.user_id)).set(permissions);
    }

    /** @returns {string} The user's avatar URL or default avatar URL */
    avatarURL() {
        if (!this.avatar) return CDN_BUILDER.defaultAvatar(this.discriminator % 5)
        return CDN_BUILDER.avatar(this.user_id, this.avatar)
    }

    /** @returns {import("discord.js").EmbedAuthorData} */
    toEmbedAuthor() {
        return { name: this.tag, iconURL: this.avatarURL() };
    }

    /**
     * @param {Guild} guild
     */
    toEmbed(guild) {
        const member = (guild ? this.getMember(guild) : null)
        const title = this.tag + ((member && member.displayName.toLowerCase() !== this.username.toLowerCase()) ? ` (${member.displayName})` : '')
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setThumbnail(this.avatarURL())
            .setColor(member?.displayColor ?? this.accent_color ?? Colors.ScrimsRed)
            .addFields({ name: "User ID", value: this.user_id, inline: true })
            
        if (this.joined_at) embed.addFields({ name: "Registered At", value: `<t:${this.joined_at}:d>`, inline: true })
        if (this.country) embed.addFields({ name: "Country", value: this.country, inline: true })
        if (this.getUTCOffset()) embed.addFields({ name: "Timezone", value: `${this.timezone} (${this.getUTCOffset()})`, inline: true })
        if (member && this.bot) {
            const positions = this.bot.permissions.getMemberPositions(member)
            if (positions.length > 0) embed.addFields({ 
                name: "Scrims Positions", value: positions.map(pos => pos.asUserInfo(guild?.id)).join('\n')
            })
        }
        return embed;
    }

}

module.exports = UserProfile;