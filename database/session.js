const { time } = require("discord.js");

const MessageOptionsBuilder = require("../tools/payload_builder");
const I18n = require("../tools/internationalization");
const { Colors } = require("../tools/constants");
const TextUtil = require("../tools/text_util");

const TableRow = require("../postgresql/row");
const SessionParticipant = require("./session_participant");

class Session extends TableRow {

    constructor(client, sessionData) {

        super(client, sessionData)

        /** @type {string} */
        this.id_session
        if (!this.id_session) this.setId()

        /** @type {string} */
        this.type

        /** @type {string} */
        this.creator_id

        /** @type {number} */
        this.started_at

        /** @type {number} */
        this.ended_at

    }

    /** @param {string} [id_session] if falsely will use a random uuid */
    setId(id_session) {
        this.id_session = id_session ?? this.client.generateUUID()
        return this;
    }

    /** 
     * @param {'prime_vouch_duel'} type 
     */
    setType(type) {
        this.type = type
        return this;
    }

    get creator() {
        if (!this.bot || !this.creator_id) return null;
        return this.bot.users.resolve(this.creator_id);
    }

    get creatorProfile() {
        return this.client.users.cache.find(this.creator_id);
    }

    /** 
     * @param {string|import('./user_profile')|import('discord.js').User} creator 
     */
    setCreator(creator) {
        this.creator_id = creator?.user_id ?? creator?.id ?? creator
        return this;
    }

    /**
     * @param {number} [started_at] If undefined will use current timestamp 
     */
    setStartPoint(started_at) {
        this.started_at = started_at ?? Math.floor(Date.now()/1000)
        return this;
    }

    /**
     * @param {number} [ended_at] If undefined will use current timestamp 
     */
    setEndPoint(ended_at) {
        this.ended_at = ended_at ?? Math.floor(Date.now()/1000)
        return this;
    }

    getDuration() {
        if (!this.started_at || !this.ended_at) return `*unknown*`;
        return TextUtil.stringifyTimeDelta(this.ended_at - this.started_at);
    }

    getStart() {
        if (!this.started_at) return `*unknown*`;
        return time(this.started_at, 'f');
    }

    getEnd() {
        if (!this.ended_at) return `*unknown*`;
        return time(this.ended_at, 'f');
    }

    /**
     * @param {I18n} i18n
     */
    toEmbed(i18n) {
        return i18n.getEmbed(
            "sessions.summary", { 
                title: [TextUtil.snakeToUpperCamelCase(this.type)], 
                description: [
                    this.id_session, `${this.creatorProfile}`, this.getStart(), 
                    this.getEnd(), this.getDuration() 
                ] 
            }
        ).setColor(Colors.BasketBallOrange)
    }

    /**
     * @param {I18n} i18n 
     * @param {SessionParticipant[]} participants 
     */
    toMessage(i18n, participants) {
        const participation = ((participants.length > 0) ? participants.map(p => p.toString()) : [i18n.get("sessions.no_participation")])
        return new MessageOptionsBuilder()
            .addEmbeds(
                this.toEmbed(i18n),
                i18n.getEmbed("sessions.participation")
                    .setDescription(TextUtil.reduceArray(participation, 3500))
                    .setColor(Colors.NiceBlue)
            )
    }

    /**
     * @param {I18n} i18n 
     * @param {SessionParticipant[]} participants 
     */
    getDetails(i18n, participants) {
        return i18n.get(
            "sessions.details", TextUtil.snakeToUpperCamelCase(this.type), `${this.creatorProfile}`, 
            this.getStart(), this.getDuration(), participants.length
        )
    }

}

module.exports = Session;