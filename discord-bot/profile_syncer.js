const { Guild, User, GuildMember, Events, BaseGuild } = require("discord.js")
const UserProfile = require("../database/user_profile")
const DiscordUtil = require("../tools/discord_util")

class UserProfileUpdater {

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
        this.bot.on(Events.GuildMemberAdd, member => this.onMemberAdd(member).catch(console.error))
        this.bot.on(Events.UserUpdate, (_, newUser) => this.update(newUser).catch(console.error))
        this.bot.on(Events.GuildCreate, guild => this.initializeGuildMembers(guild).catch(console.error))
    }

    /**
     * @param {User} user 
     * @param {UserProfile} [profile]
     */
    async update(user, profile) {
        if (!profile) profile = this.database.users.cache.find({ user_id: user.id })
        if (profile) {
            const updated = profile.clone().setDiscord(user)
            if (!profile.exactlyEquals(updated)) 
                await this.database.users.sqlUpdate(profile, updated)
                    .catch(err => console.error(`Unable to update profile for ${profile.user_id}! (${err})`))
        }
    }

    /** @param {GuildMember} member */
    async onMemberAdd(member) {
        if (member.guild.id !== this.bot.hostGuildId || this.bot.servesHost) await this.ensureProfile(member.user)
        await this.ensureProfileJoinedAt(member)
    }

    async initialize() {
        console.log("Initializing profiles...")
        await Promise.all(this.bot.guilds.cache.map(guild => this.initializeGuildMembers(guild).catch(console.error)))
        console.log("Profiles initialized!")
    }

    /** @param {Guild} guild */
    async initializeGuildMembers(guild) {
        const members = await guild.members.fetch()
        const profiles = await this.database.users.fetchMap({}, ["user_id"])
        await Promise.all(members.map(m => this.ensureProfile(m.user, profiles))).catch(console.error)
        await Promise.all(members.map(m => this.ensureProfileJoinedAt(m, profiles))).catch(console.error)

        for await (const bans of DiscordUtil.multiFetch(guild.bans, 1000))
            await Promise.all(
                bans.filter(b => b.user)
                    .map(b => this.ensureProfile(b.user, profiles).catch(console.error))
            )
    }

    /** 
     * @param {User} user 
     * @param {Object.<string, UserProfile>} [profiles]
     */
    async ensureProfile(user, profiles) {
        const profile = profiles ? profiles[user.id] : this.database.users.cache.find(user.id)
        if (!profile) return this.createProfile(user).then(profile => {
            if (profiles && profile) profiles[user.id] = profile
            return profile || null;
        })
        return this.update(user, profile).then(() => profile)
    }

    /** 
     * @param {GuildMember} member
     * @param {Object.<string, UserProfile>} [profiles]
     */
    async ensureProfileJoinedAt(member, profiles) {
        if (member.guild.id === this.bot.hostGuildId && this.bot.servesHost) {
            const profile = profiles ? profiles[member.id] : this.database.users.cache.find(member.id)
            if (profile && !profile.joined_at && member.joinedTimestamp) 
                await this.database.users.sqlUpdate(profile, { joined_at: Math.floor(member.joinedTimestamp / 1000) })
                    .catch(err => console.error(`Unable to update profile joined_at for ${member.id} (${err})!`, member.joinedTimestamp))
        }
    }
    
    /** @param {User} user */
    async createProfile(user) {
        return this.bot.database.users.create(UserProfile.fromUser(user))
            .catch(error => console.error(`Unable to make profile for ${user.id}! (${error})`))
    }

}

module.exports = UserProfileUpdater;