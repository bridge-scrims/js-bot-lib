const GameParticipant = require('../game_participant');

class GameParticipantCollection {
    
    /** @param {import('../../postgresql/database')} database */
    static readData(database) {
        return database.gameParticipants.cache.getArrayMap('id_game')
    }

    /** @param {import('../../postgresql/database')} database */
    static fetchData(database, selector) {
        return database.gameParticipants.fetchArrayMap(selector, ['id_game'])
    }

    constructor(game) {

        Object.defineProperty(this, "game", { value: game })

        /** 
         * @readonly
         * @type {import('../game')} 
         */
        this.game

        /** @type {GameParticipant[]} */
        this.participants

    }

    get bot() {
        return this.game.bot;
    }

    get client() {
        return this.game.client;
    }

    /**
     * @param {GameParticipant[]|Object.<string, GameParticipant[]>} [participants] 
     */
    set(participants) {
        if (participants instanceof Array) participants = participants.filter(v => v.id_game === this.game.id_game);
        else participants = (participants?.[this.game.id_game] ?? []);

        this.participants = participants
        return this;
    }

    read() {
        this.participants = this.client.gameParticipants.cache.get({ id_game: this.game.id_game })
        return this;
    }

    async fetch() {
        this.participants = await this.client.gameParticipants.sqlFetch({ id_game: this.game.id_game })
        return this;
    }

    /**
     * @param {number} id_team 
     * @param {import('../user_profile').UserResolvable} userResolvables 
     */
    async addTeam(id_team, userResolvables) {
        const participants = userResolvables.map(u => new GameParticipant(this.client).setGame(this.game).setTeam(id_team).setUser(u))
        const added = await Promise.all(participants.map(p => this.client.gameParticipants.create(p)))
        this.participants.push(...added)
    }

    /** @param {string|import('../user_profile')} userResolvable */
    getTeamId(userResolvable) {
        return this.get(userResolvable)?.id_team ?? null;
    }

    /** @param {string|import('../user_profile')|number} teamResolvable */
    getTeam(teamResolvable) {
        const id_team = ((typeof teamResolvable === "number") ? teamResolvable : this.get(teamResolvable)?.id_team)
        return this.participants.filter(participant => participant.id_team === id_team);
    }

    /** @returns {Object.<string, import('../game_participant')[]>} */
    getTeams() {
        const teams = {}
        this.participants.forEach(p => (teams[p.id_team] ? teams[p.id_team].push(p) : teams[p.id_team] = [p]))
        return teams;
    }

    /** @param {string|import('../user_profile')} userResolvable */
    get(userResolvable) {
        const user_id = userResolvable?.user_id ?? userResolvable
        return this.participants.find(participant => participant.user_id === user_id) ?? null;
    }

    /** @param {(string|import('../user_profile'))[]} userResolvables */
    isParticipating(...userResolvables) {
        return userResolvables.every(u => this.get(u));
    }

    asEmbedFields() {
        return Object.entries(this.getTeams())
            .map(([_, participants]) => participants.map(p => p.user).filter(v => v))
            .filter(v => v.length > 0)
            .map((v, i) => ({ name: `Team ${i+1}`, value: v.join("\n"), inline: true }))
    }

}

module.exports = GameParticipantCollection;