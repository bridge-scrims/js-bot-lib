const TableRow = require("../postgresql/row")

class GameParticipant extends TableRow {

    constructor(client, participantData) {

        super(client, participantData)

        /** @type {number} */
        this.id_game

        /** @type {string} */
        this.user_id

        /** @type {number} */
        this.id_team

    }

    /** @override */
    isCacheExpired(now) {
        return (!this.game) && (!now || super.isCacheExpired(now));
    }

    /** @param {number} id_team */
    setTeam(id_team) {
        this.id_team = id_team
        return this
    }

    /**
     * @param {number|Object.<string, any>|import('./game')} gameResolvable
     */
    setGame(gameResolvable) {
        this._setForeignObjectKeys(this.client.games, ['id_game'], ['id_game'], gameResolvable)
        return this
    }

    get game() {
        return this.client.games.cache.find(this.id_game);
    }

    /** 
     * @param {string|import('./user_profile')|import('discord.js').User} user
     */
    setUser(user) {
        this.user_id = user?.user_id ?? user?.id ?? user
        return this;
    }

    get user() {
        if (!this.bot || !this.user_id) return null;
        return this.bot.users.resolve(this.user_id);
    }

    get userProfile() {
        return this.client.users.cache.find(this.user_id);
    }

    /** 
     * @override
     * @param {Object.<string, any>} gameData 
     */
    update(gameData) {
        super.update(gameData)
        this.setGame(gameData.game)
        return this
    }

}

module.exports = GameParticipant