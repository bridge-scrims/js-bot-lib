const { userMention } = require("discord.js")

const GameParticipantCollection = require("./collections/game_participants")
const GameParticipant = require("./game_participant")
const I18n = require("../tools/internationalization")
const TableRow = require("../postgresql/row")
const DBType = require("./type")

class Game extends TableRow {

    constructor(client, gameData) {

        super(client, gameData)

        /** @type {number} */
        this.id_game

        /** @type {number} */
        this.id_type

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
     * @param {string|DBType} typeResolvable 
     */
    setType(typeResolvable) {
        if (typeof typeResolvable === "string") typeResolvable = { name: typeResolvable }
        this._setForeignObjectKeys(this.client.gameTypes, ['id_type'], ['id_type'], typeResolvable)
        return this
    }   

    get type() {
        return this.client.gameTypes.cache.find(this.id_type);
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
     * @override
     * @param {Object.<string, any>} gameData 
     */
    update(gameData) {   
        super.update(gameData)
        this.setType(gameData.type)
        return this
    }

    /**
     * @param {I18n} i18n
     * @param {GameParticipant[]|Object.<string, GameParticipant[]>|GameParticipantCollection} [participants]
     * @returns {import("discord.js").EmbedField}
     */
    toEmbedField(i18n, participants) {
        return {
            name: `<t:${this.started_at}:R>`,
            inline: true,
            value: Object.values(this.getParticipants(participants).getTeams())
                .map(v => v.map(u => userMention(u.user_id)).join(" ")).join(`\n**══ ${i18n.get("vs")} ══**\n`) || i18n.get("games.no_participants")
        }
    }

}

module.exports = Game