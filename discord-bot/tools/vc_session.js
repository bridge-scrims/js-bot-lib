const { VoiceBasedChannel, VoiceState, User, Events } = require("discord.js");

const I18n = require("../../tools/internationalization");
const TextUtil = require("../../tools/text_util");

const SessionParticipant = require("../../database/session_participant");
const Session = require("../../database/session");

const MIN_LENGTH = 15*60
const MIN_PARTICIPANTS = 5
const MIN_PARTICIPATE_TIME = 1*60

// const MIN_LENGTH = 30
// const MIN_PARTICIPANTS = 1
// const MIN_PARTICIPATE_TIME = 30

class PendingVCSessionParticipant extends SessionParticipant {

    constructor(...args) {

        super(...args)

        /** @type {number[]} */
        this.breaks = []

        /** @type {number} */
        this.left_at = null

    }

    /**
     * @param {PendingVoiceChannelBasedSession} session 
     * @param {User} user 
     */
    joined(session, user) {
        this.setSession(session)
        this.setUser(user)
        this.setJoinPoint()
        return this;
    }

    disconnected() {
        this.left_at = Math.floor(Date.now() / 1000)
    }

    rejoined() {
        if (this.left_at) {
            this.breaks.push(Math.floor((Date.now() / 1000) - this.left_at))
            this.left_at = null
        }else {
            this.joined_at = Math.floor(Date.now() / 1000)
        }
    }

    async create(trimTime=0) {
        this.participation_time = this.calculateParticipation(trimTime)
        if (this.participation_time < MIN_PARTICIPATE_TIME) return false;
        return this.client.sessionParticipants.create(this.toSQLData());
    }

    calculateParticipation(trimTime=0) {
        const actualEnd = (Date.now() / 1000) - trimTime
        const referenceTime = Math.min((this.left_at ?? actualEnd), actualEnd)
        const breakTime = this.breaks.reduce((pv, cv) => pv + cv, 0)
        return Math.floor((referenceTime - this.joined_at) - breakTime)
    }

    stringifyParticipationTime() {
        return TextUtil.stringifyTimeDelta(this.calculateParticipation(0))
    }

    /** @override */
    toString() {
        const symbol = (this.left_at ? ":small_orange_diamond:" : ":small_blue_diamond:")
        return `${symbol}  <@${this.user_id}>**:**  ${this.stringifyParticipationTime()}`
    }

}

class PendingVoiceChannelBasedSession extends Session {

    /** @type {Object.<string, PendingVoiceChannelBasedSession>} */
    static pending = {}
    static find(channelId) {
        return this.pending[channelId] ?? null;
    }
    static values() {
        return Object.values(this.pending);
    }

    constructor(...args) {

        super(...args)

        /** @type {VoiceBasedChannel|null} */
        this.channel = null

        /** @type {Object.<string, PendingVCSessionParticipant>} */
        this.participants = {}

        /**
         * @readonly
         * @type {import("../bot")}
         */
        this.bot

    }

    /**
     * @param {VoiceBasedChannel} voiceChannel 
     * @param {string} typeName 
     * @param {User} creator 
     */
    start(voiceChannel, typeName, creator) {

        this.setType(typeName)
        this.setCreator(creator)
        this.setChannel(voiceChannel)
        this.setEndPoint(null)
        this.setStartPoint()

        this.initialize()
        this.addListeners()

        this.client.ipc.notify("vc_session_initialized", { session: this, guild_id: voiceChannel.guild.id, channel: `${voiceChannel}` })
        PendingVoiceChannelBasedSession.pending[voiceChannel.id] = this
        return this;
    
    }

    /** @param {VoiceBasedChannel|null} channel */
    setChannel(channel) {
        this.channel = channel
        return this;
    }

    addListeners() {
        this.voiceUpdateCallback = async (...args) => this.onVoiceStateUpdate(...args).catch(console.error)
        this.bot.on(Events.VoiceStateUpdate, this.voiceUpdateCallback)
    }

    initialize() {
        if (!this.channel) return false;
        for (const member of this.channel.members.values()) {
            if (!(member.id in this.participants)) 
                this.participants[member.id] = new PendingVCSessionParticipant(this.client).joined(this, member.user)
        }
    }

    /**
     * @param {VoiceState} oldState 
     * @param {VoiceState} newState 
     */
    async onVoiceStateUpdate(oldState, newState) {
        if (!this.channel) return false;
        const member = newState.member

        // Someone joined this channel
        if (newState.channel === this.channel && oldState.channel !== this.channel) {
            if (!(member.id in this.participants)) {
                this.participants[member.id] = new PendingVCSessionParticipant(this.client).joined(this, member.user)
            }else {
                // Someone rejoined
                this.participants[member.id].rejoined()
            }
        }

        // Someone left this channel
        if (oldState.channel === this.channel && newState.channel !== this.channel) {
            if (member.id in this.participants) {
                this.participants[member.id].disconnected()
            }
        }
    }

    destroy() {
        delete PendingVoiceChannelBasedSession.pending[this?.channel?.id]
        this.bot.off(Events.VoiceStateUpdate, this.voiceUpdateCallback)
        super.destroy()
    }

    async end(trimTime=0, discard=false) {
        this.destroy()
        this.setEndPoint(Math.floor((Date.now() / 1000) - trimTime))

        const length = this.ended_at - this.started_at 
        // It is not worth saving this in the database
        if (length < MIN_LENGTH || (Object.keys(this.participants).length < MIN_PARTICIPANTS) || discard) {
            this.client.ipc.notify("vc_session_discarded", { 
                session: this, channel: `${this.channel}`,
                guild_id: this.channel.guild.id
            })
            return false;
        }

        await this.client.sessions.create(this.toSQLData())
        for (const participant of Object.values(this.participants))
            await participant.create(trimTime).catch(console.error)

        this.client.ipc.notify("vc_session_created", { 
            session: this, guild_id: this.channel.guild.id, channel: `${this.channel}`
        })
    }

    /** 
     * @override
     * @param {I18n} i18n 
     */
    toMessage(i18n) {
        return super.toMessage(i18n, Object.values(this.participants))
    }

    /** @override */
    getDuration() {
        if (!this.ended_at) return `:red_circle:  Ongoing${(this.channel ? ` in ${this.channel}` : "")}`;
        return super.getDuration();
    }

    /** @override */
    getEnd() {
        if (!this.ended_at) return `***Hasn't ended yet***`;
        return super.getEnd();
    }

    /** 
     * @override
     * @param {I18n} i18n 
     */
    getDetails(i18n) {
        return super.getDetails(i18n, Object.values(this.participants))
    }

}

module.exports = PendingVoiceChannelBasedSession;