const LocalizedError = require('../tools/localized_error');
const got = require('got');

class ChalllongeAPIError extends LocalizedError {

    constructor(externalFault, ...args) {
        super(...args);
        this.externalFault = externalFault
    }

}

const API_TOKEN = process.env.CHALLONGE_TOKEN
const SERVER = 'api.challonge.com/v1'
const TIMEOUT = 7000
const OPTIONS = { 
    responseType: 'json', timeout: TIMEOUT, 
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
}

class ChallongeBracketClient {

    static get Error() {
        return ChalllongeAPIError;
    }

    /**
     * @param {string} tourneyId 
     */
    constructor(tourneyId) {

        /** @readonly */
        this.tourneyId = tourneyId

    }  

    /** @returns {import('./types').ChallongeParticipants} */
    extractParticipants(participants=[]) {
        return Object.fromEntries(participants.map(item => [item.participant.id, item.participant]));
    }

    /** @returns {import('./types').ChallongeMatches} */
    extractMatches(matches=[]) {
        return Object.fromEntries(matches.map(item => [item.match.id, item.match]))
    }

    /** @returns {import('./types').ChallongeTournament} */
    formatTournament(tourney) {
        tourney.matches = this.extractMatches(tourney.matches)
        tourney.participants = this.extractParticipants(tourney.participants)
        return tourney;
    }

    buildURL(path, parameters={}) {
        path = [this.tourneyId, ...path]
        return `https://${SERVER}/tournaments/${path.join('/')}.json?api_key=${API_TOKEN}${Object.entries(parameters).map(([k, v]) => `&${k}=${v}`).join('')}`;
    }

    async start() {
        const url = this.buildURL(['start'], { include_participants: 1, include_matches: 1 })
        const response = await got.post(url, OPTIONS).catch(error => this.onError(error));
        return this.formatTournament(response.body.tournament);
    }

    async getTournament() {
        const url = this.buildURL([], { include_participants: 1, include_matches: 1 })
        const response = await got.get(url, OPTIONS).catch(error => this.onError(error));
        return this.formatTournament(response.body.tournament);
    }

    async addParticipant(name, misc) {
        const options = { ...OPTIONS, body: JSON.stringify({ participant: { name, misc } }) }
        const response = await got.post(this.buildURL(['participants']), options).catch(error => this.onError(error)); 
        return Object.values(this.extractParticipants([response.body]))[0];
    }

    async getMatches() {
        const response = await got.get(this.buildURL(['matches']), OPTIONS).catch(error => this.onError(error));
        return this.extractMatches(response.body);
    }
    
    async getParticipants() {
        const response = await got.get(this.buildURL(['participants']), OPTIONS).catch(error => this.onError(error));
        return this.extractParticipants(response.body);
    }
    
    async startMatch(matchId) {
        const url = this.buildURL(['matches', matchId, 'mark_as_underway'])
        const response = await got.post(url, OPTIONS).catch(error => this.onError(error));
        return Object.values(this.extractMatches([response.body]))[0];
    }
    
    async updateMatch(matchId, score, winner_id) {
        const options = { ...OPTIONS, body: JSON.stringify({ match: { scores_csv: (!score) ? '0-0' : score, winner_id } }) }
        const response = await got.put(this.buildURL(['matches', matchId]), options).catch(error => this.onError(error));
        return Object.values(this.extractMatches([response.body]))[0];
    }
    
    async removeParticipant(participantId) {
        const url = this.buildURL(['participants', participantId])
        const response = await got.delete(url, OPTIONS).catch(error => this.onError(error));
        return Object.values(this.extractParticipants([response.body]))[0];
    }

    async onError(error) {
        if (error instanceof got.TimeoutError) throw new ChalllongeAPIError(true, "api.timeout", "Challonge API");
        if (error instanceof got.HTTPError) {
            const code = error.response.statusCode
            console.error(`${code} Challonge API Response!`, error)
            throw new ChalllongeAPIError((code >= 500), `api.request_failed`, "Challonge API");
        }

        const errors = error?.response?.body?.errors
        if (errors) console.error('Errors in Challonge API Response', errors)
        else console.error("Unexpected Challonge API Error", error)

        throw new ChalllongeAPIError(false, `api.request_failed`, "Challonge API");
    }

}

module.exports = ChallongeBracketClient;