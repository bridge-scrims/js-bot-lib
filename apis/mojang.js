const LocalizedError = require('../tools/localized_error');
const APICache = require('./cache');
const got = require('got');

class MojangAPIError extends LocalizedError {
    constructor(externalFault, ...args) {
        super(...args);
        this.externalFault = externalFault
    }
}

const TIMEOUT = 5000

/** @type {APICache<import("./types").MojangUserProfile>} */
const profilesCache = new APICache(60*60, 100)

/** @type {APICache<import("./types").MojangResolvedUser>} */
const usersCache = new APICache(60*60, 100)

class MojangClient {
    
    static unavailable = false;

    static get Error() {
        return MojangAPIError;
    }

    static get profilesCache() {
        return profilesCache;
    }

    static get usersCache() {
        return usersCache;
    }

    /** 
     * @protected
     * @returns {Promise<import('got').Response<Object.<string, any>>>}
     */
    static async mojangRequest(server, path) {
        const url = `https://${server}/${path.join("/")}`
        const response = await got(url, { timeout: TIMEOUT, responseType: 'json', retry: 0, cache: false }).catch(error => this.onError(error));
        MojangClient.unavailable = false
        return response;
    }

    /**
     * @param {string} uuid 
     * @param {boolean} [useCache] 
     */
    static async fetchProfile(uuid, useCache=true) {
        if (useCache) {
            const profile = profilesCache.get(uuid)
            if (profile) return profile;
        }

        /** @type {import('got').Response<import("./types").MojangUserProfile>} */
        const response = await this.mojangRequest('sessionserver.mojang.com', ["session", "minecraft", "profile", uuid])

        const resolved = response.body
        if (resolved.id && resolved.name) {
            profilesCache.set(uuid, resolved)
            return resolved;
        }
        return null;
    }

    /**
     * @param {string} uuid 
     * @param {boolean} [useCache] 
     */
    static async fetchName(uuid, useCache=true) {
        return this.fetchProfile(uuid, useCache).then(v => v?.name ?? null);
    }

    /**
     * @param {string} ign 
     * @param {boolean} [useCache]
     */
    static async resolveIGN(ign, useCache=true) {
        ign = ign.replace(/\W+/g, "").trim().toLowerCase()
        
        if (useCache) {
            const user = usersCache.get(ign)
            if (user) return user;
        }

        /** @type {import('got').Response<import("./types").MojangResolvedUser>} */
        const response = await this.mojangRequest('api.mojang.com', ["users", "profiles", "minecraft", ign])
        
        const resolved = response.body
        if (resolved.id && resolved.name) {
            usersCache.set(ign, resolved)
            return resolved;
        }
        return null;
    }

    /**
     * @param {string} ign 
     * @param {boolean} [useCache]
     */
    static async fetchUUID(ign, useCache=true) {
        const user = await this.resolveIGN(ign, useCache)
        return user?.id ?? null;
    }

    static async onError(error) {
        if (error instanceof got.TimeoutError) throw new MojangAPIError(true, "api.timeout", "Mojang API");
        if (error instanceof got.HTTPError) {
            const code = error.response.statusCode
            if (code >= 500) MojangClient.unavailable = true

            console.error(`${code} Mojang API Response!`, error)
            throw new MojangAPIError((code >= 500), `api.request_failed`, "Mojang API");
        }
        console.error("Unexpected Mojang API Error", error)
        throw new MojangAPIError(false, `api.request_failed`, "Mojang API");
    }

}

module.exports = MojangClient;