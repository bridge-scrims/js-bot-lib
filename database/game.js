const { userMention, time } = require("discord.js")

const GameParticipantCollection = require("./collections/game_participants")
const GameParticipant = require("./game_participant")
const I18n = require("../tools/internationalization")
const TableRow = require("../postgresql/row")

class Game extends TableRow {

    constructor(client, gameData) {

        super(client, gameData)

        /** @type {number} */
        this.id_game

        /** @type {string} */
        this.type

    }

    /** @override */
    isCacheExpired(now) {
        return ((this.id_game + 30*24*60*60) < now) && (!now || super.isCacheExpired(now));
    }

    get started_at() {
        if (!this.id_game) return undefined;
        return Math.floor(this.id_game/1000);
    }

    /**
     * @param {number} [id] If falsely will use the current timestamp.
     */
    setId(id) {
        this.id_game = id ?? Date.now()
        return this
    }

    /**
     * @param {'prime_council_vouch_duels'} type 
     */
    setType(type) {
        this.type = type
        return this
    }

    async fetchParticipants() {
        return (new GameParticipantCollection(this)).fetch();
    }

    /**
     * @param {GameParticipant[]|Object.<string, GameParticipant[]>|GameParticipantCollection} [participants] 
     */
    getParticipants(participants) {
        if (participants instanceof GameParticipantCollection) return participants;
        return (new GameParticipantCollection(this)).set(participants);
    }

    readParticipants() {
        return (new GameParticipantCollection(this)).read();
    }

    /**
     * @param {I18n} i18n
     * @param {GameParticipant[]|Object.<string, GameParticipant[]>|GameParticipantCollection} [participants]
     * @returns {import("discord.js").EmbedField}
     */
    toEmbedField(i18n, participants) {
        return {
            name: time(this.started_at, "R"),
            inline: true,
            value: Object.values(this.getParticipants(participants).getTeams())
                .map(v => v.map(u => userMention(u.user_id)).join(" ")).join(`\n**══ ${i18n.get("vs")} ══**\n`) || i18n.get("games.no_participants")
        }
    }

}

module.exports = Game