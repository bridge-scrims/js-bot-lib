export interface HypixelPlayerData {
    uuid: string;
    displayname: string;
    rank: string;
    packageRank: string;
    newPackageRank: string;
    monthlyPackageRank: string;
    firstLogin: number;
    lastLogin: number;
    lastLogout: number;
    stats: { [x: string]: { [x: string]: any } };
    bedwars: HypixelPlayerBedwarsData
}

export interface HypixelPlayerBedwarsData {
    exp: number; 
    prestige: number; 
    progress: number; 
    level: number; 
    wins: number; 
    losses: number;
    wlr: number; 
    finalKills: number; 
    finalDeaths: number;
    fkdr: number;
    ws: number;
}

export interface MojangResolvedUser {
    name: string;
    id: string;
}

export interface MojangUserProfile extends MojangResolvedUser {

} 

export interface ChallongeTournament {
    id: number,
    name: string,
    url: string,

    participants: ChallongeParticipants,
    matches: ChallongeMatches
}

export type ChallongeMatchState = 'pending' | 'open' | 'complete'

export type ChallongeMatches = { [x: string]: ChallongeMatch }
export interface ChallongeMatch {
    id: number,
    state: ChallongeMatchState,
    round: number,
    player1_id: ?number,
    player2_id: ?number,
    started_at: ?string,
    winner_id: ?number,
    loser_id: ?number
}

export type ChallongeParticipants = { [x: string]: ChallongeParticipant }
export interface ChallongeParticipant {
    id: number,
    name: string,
    misc: string,
    created_at: string,
    seed: number
}