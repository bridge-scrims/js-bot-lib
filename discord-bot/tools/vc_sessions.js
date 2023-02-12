const { VoiceState, GuildMember } = require("discord.js");
const PendingVoiceChannelBasedSession = require("./vc_session");

/**
 * @typedef SessionManagerConfig
 * @property {import("../../database/position").PositionResolvable[]} [modPositions]
 * @property {number} [timeout]
 * @property {(state: VoiceState) => boolean} [createVerifyCall]
 */

/** @type {import("../permissions").Permissions} */
const BASE_MOD_PERMISSIONS = { positionLevel: "staff", allowedPermissions: ["Administrator"] }

class VoiceBasedSessionsManager {

    /** @type {Object.<string, VoiceBasedSessionsManager>} */
    static sessionManagers = {}

    /** @param {string} sessionTypeName */
    static getManager(sessionTypeName) {
        return this.sessionManagers[sessionTypeName];
    }

    /** @param {string} [sessionTypeName] */
    static getCommandPermissions(sessionTypeName) {
        const managers = sessionTypeName ? [this.getManager(sessionTypeName)] : Object.values(this.sessionManagers)
        return { 
            ...BASE_MOD_PERMISSIONS, 
            allowedPositions: managers.map(v => v?.modPositions ?? []).flat() 
        };
    }

    /** 
     * @param {GuildMember} member
     * @param {string} sessionTypeName 
     */
    static isPermitted(member, sessionTypeName) {
        return this.sessionManagers[sessionTypeName]?.isPermitted(member);
    }

    /** 
     * @param {string} typeName
     * @param {SessionManagerConfig} [config] 
     */
    constructor(bot, typeName, config={}) {

        Object.defineProperty(this, "bot", { value: bot })

        /** 
         * @readonly
         * @type {import("../bot")} 
         */
        this.bot

        this.typeName = typeName
        this.modPositions = config.modPositions ?? []
        this.modPermissions = { ...BASE_MOD_PERMISSIONS, allowedPositions: this.modPositions }
        this.timeout = config.timeout ?? 0
        this.createVerifyCall = config.createVerifyCall

        /** @type {Object.<string, PendingVoiceChannelBasedSession} */
        this.sessions = {}

        /** @type {Object.<string, number>} */
        this.expirations = {}

        this.database.on('connected', () => this.onConnected())
        VoiceBasedSessionsManager.sessionManagers[this.typeName] = this

    }

    get database() {
        return this.bot.database;
    }

    onConnected() {
        this.bot.on('voiceStateUpdate', (oldState, newState) => this.onVoiceStateUpdate(oldState, newState))
    }

    getSession(channelId) {
        return this.sessions[channelId] ?? null;
    }

    /** @param {GuildMember} member */
    isPermitted(member) {
        return this.bot.permissions.hasPermission(member.id, null, member, this.modPermissions);
    }
 
    /**
     * @protected
     * @param {VoiceState} oldState 
     * @param {VoiceState} newState 
     */
    async onVoiceStateUpdate(oldState, newState) {
        const member = newState.member

        // Member is not permitted so idc what they are doing rn
        if (!this.isPermitted(member)) return false;

        // joined a voice channel
        if (newState.channel && oldState.channel !== newState.channel) {
            if (newState.channelId in this.expirations) {
                clearTimeout(this.expirations[newState.channelId])
                delete this.expirations[newState.channelId]           
            }
        }

        if (newState.channel && (!this.createVerifyCall || this.createVerifyCall(newState))) this.start(newState.channel, member.user)

        // left a voice channel
        if ((!newState.channel) && oldState.channel !== newState.channel) {
            // No more permitted members in voice call
            if (!oldState.channel.members.some(member => this.isPermitted(member))) {

                if (oldState.channelId in this.expirations) {
                    clearTimeout(this.expirations[oldState.channelId])
                    delete this.expirations[oldState.channelId]
                }
    
                if (oldState.channelId in this.sessions) {
                    const endTimeout = setTimeout(() => this.end(oldState.channelId).catch(console.error), this.timeout*1000)
                    this.expirations[oldState.channelId] = endTimeout
                }

            }
        }

    }

    start(channel, user) {
        if (!(channel?.id in this.sessions)) {
            const session = new PendingVoiceChannelBasedSession(this.database).start(channel, this.typeName, user)
            this.sessions[channel.id] = session
            this.database.sessions.cache.push(session)
            return session;
        }
    }

    exists(channelId) {
        return (channelId in this.sessions);
    }

    async end(channelId, discard) {
        delete this.expirations[channelId]
        const session = this.sessions[channelId]
        if (session) {
            delete this.sessions[channelId]
            this.database.sessions.cache.remove(session.id)
            await session.end(this.timeout, discard)
            return session;
        }
    }

}

module.exports = VoiceBasedSessionsManager