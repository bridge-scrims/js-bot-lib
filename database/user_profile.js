const { User, Guild, EmbedBuilder, time, CDN, GuildMember } = require("discord.js");
const moment = require("moment-timezone");

const RESTCountriesClient = require("../apis/countries");
const MojangClient = require("../apis/mojang");

const { Colors } = require("../tools/constants");
const TimeUtil = require("../tools/time_util");

const UserPermissionsCollection = require("./collections/user_permissions");
const PermissionData = require("./permission_data");
const TableRow = require("../postgresql/row");

const CDN_BUILDER = new CDN()

/**
 * @typedef {string|UserProfile|User} UserResolvable
 */

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

        /** @type {string} */
        this.username

        /** @type {number} */
        this.discriminator

        /** @type {?number} */
        this.joined_at

        /** @type {?string} */
        this.mc_uuid

        /** @type {?string} */
        this.country

        /** @type {?string} */
        this.timezone

    }

    get user() {
        if (!this.bot || !this.user_id) return null;
        return this.bot.users.resolve(this.user_id);
    }

    async fetchUser() {
        if (!this.bot || !this.user_id) return null;
        return this.bot.users.fetch(this.user_id);
    }

    get mention() {
        if (!this.user_id) return `*Unknown User*`;
        return `<@${this.user_id}>`;
    }

    get tag() {
        const lastKnownTag = `${this.username}#${`${this.discriminator}`.padStart(4, '0')}`;
        return this.user?.tag || lastKnownTag || `Unknown User`;
    }

    get name() {
        return this.user?.username || this.username;
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

    /** @param {string|number} discriminator */
    setDiscriminator(discriminator) {
        this.discriminator = parseInt(discriminator) || null
        return this;
    }

    /** @param {User} user */
    setDiscord(user) {
        this.user_id = user.id
        this.username = user.username
        this.setDiscriminator(user.discriminator)
        return this;
    }    

    /** @param {number} [joined_at] if undefined will use the current time */
    setJoinPoint(joined_at=Math.floor(Date.now()/1000)) {
        this.joined_at = joined_at
        return this;
    }

    /** @param {?string} uuid */
    setMCUUID(uuid) {
        this.mc_uuid = uuid
        return this;
    }

    /** @param {?string} country */
    setCountry(country) {
        this.country = country
        return this;
    }

    /** @param {?string} timezone */
    setTimezone(timezone) {
        this.timezone = timezone
        return this;
    }

    get countryName() {
        return RESTCountriesClient.Countries.find(v => v.cca3 === this.country)?.name?.common || this.country;
    }

    getCurrentTime() {
        if (!this.timezone) return null;
        return moment.tz(moment(), this.timezone);        
    }

    getUTCOffset() {
        return TimeUtil.stringifyOffset(this.timezone);
    }

    async fetchMCUsername() {
        if (!this.mc_uuid) return "Unknown User";
        return MojangClient.fetchName(this.mc_uuid)
    }

    mcHeadURL() {
        return `https://mc-heads.net/head/${this.mc_uuid || 'MHF_Steve'}/left`;
    }

    avatarURL() {
        return this.user?.displayAvatarURL() || CDN_BUILDER.defaultAvatar(this.discriminator % 5)
    }

    /** @returns {import("discord.js").EmbedAuthorData} */
    toEmbedAuthor() {
        return { name: this.tag, iconURL: this.avatarURL() };
    }

    /** @param {Guild} [guild] */
    getMember(guild) {
        if (!guild || !this.user_id) return null;
        return guild.members.cache.get(this.user_id) || null;
    }

    /** @param {Guild} [guild] */
    async fetchMember(guild) {
        if (!guild || !this.user_id) return null;
        return guild.members.fetch(this.user_id);
    }

    async fetchPermissions() {
        return (new UserPermissionsCollection(this.client, this.user_id)).fetch();
    }

    /** @param {PermissionData|UserPermissionsCollection} permissions */
    getPermissions(permissions) {
        if (permissions instanceof UserPermissionsCollection) return permissions;
        return (new UserPermissionsCollection(this.client, this.user_id)).set(permissions);
    }

    /**
     * @param {Guild} guild
     */
    toEmbed(guild) {
        const member = (guild ? this.getMember(guild) : null)
        const title = this.tag + ((member && member.displayName.toLowerCase() !== this.name.toLowerCase()) ? ` (${member.displayName})` : '')
        const embed = new EmbedBuilder()
            .setTitle(title)
            .setThumbnail(member?.displayAvatarURL() || this.user?.displayAvatarURL() || null)
            .setColor(member?.displayColor || this.user?.hexAccentColor || Colors.ScrimsRed)
            .addFields({ name: "User ID", value: this.user_id, inline: true })
            
        if (this.joined_at) embed.addFields({ name: "Registered At", value: time(this.joined_at, "d"), inline: true })
        if (this.country) embed.addFields({ name: "Country", value: this.countryName, inline: true })
        if (this.timezone) embed.addFields({ name: "Timezone", value: `${this.timezone} (${this.getUTCOffset()})`, inline: true })
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