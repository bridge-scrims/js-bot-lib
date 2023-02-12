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
            await user.fetch(true)
            if (profile.tag !== user.tag || profile.avatar !== user.avatar || profile.accent_color !== user.accentColor) {
                await this.updateProfile(profile, {
                    username: user.username, 
                    discriminator: user.discriminator,
                    accent_color: user.accentColor,
                    avatar: user.avatar
                })
            }
        }
    }

    /** @param {GuildMember} member */
    async onMemberAdd(member) {
        if (member.guild.id !== this.bot.hostGuildId || this.bot.servesHost)
            await this.ensureProfile(member.user).catch(console.error)
    }

    /** @param {BaseGuild[]} guilds */
    async initialize(guilds) {

        console.log("Initializing profiles...")
        await Promise.all(guilds.map(guild => this.initializeGuildMembers(guild).catch(console.error)))
        console.log("Profiles initialized!")

    }

    /** @param {Guild} guild */
    async initializeGuildMembers(guild) {

        guild = await guild.fetch()

        const members = await guild.members.fetch()
        const profiles = await this.database.users.fetchMap({}, ["user_id"])
        await Promise.all(members.map(m => this.ensureProfile(m.user, profiles).catch(console.error)))

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
        const profile = profiles ? profiles[user.id] : this.database.users.cache.find({ user_id: user.id })
        if (!profile) await this.createProfile(user)
        else if (!profiles) await this.update(user, profile)
    }
    
    /** 
     * @param {User} user
     */
    async createProfile(user) {
        return this.bot.database.users.create(UserProfile.fromUser(user))
            .catch(error => console.error(`Unable to make profile for ${user.id}! (${error})`))
    }

    /**
     * @param {UserProfile} profile 
     * @param {Object.<string, any>} changes
     */
    async updateProfile(profile, changes) {
        await this.bot.database.users.update(profile, changes)
            .catch(error => console.error(`Unable to update profile for ${profile.user_id}! (${error})`, changes))
    }

}

module.exports = UserProfileUpdater;