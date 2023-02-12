const { User, GuildMember, Collection, userMention } = require("discord.js");

class DiscordUtil {

    /**
     * @param {User|GuildMember} user 
     * @returns {?import("discord.js").EmbedAuthorData}
     */
    static userAsEmbedAuthor(user) {
        if (!user) return null;
        return {
            name: user?.tag || user?.user?.tag,
            iconURL: user?.displayAvatarURL?.() || user.avatarURL()
        }
    }
    
    /**
     * @template K, V 
     * @param {CachedManager<K, V>} cacheManager 
     * @param {number} [chunkSize] 
     * @param {number} [limit] 
     * @returns {AsyncGenerator<Collection<K, V>, void, Collection<K, V>>} 
     */
    static async* multiFetch(cacheManager, chunkSize=100, limit) {

        /** @type {Collection<K, V>} */
        let chunk = await cacheManager.fetch({ limit: chunkSize })
        
        while (true) {
            if (limit !== undefined) limit -= chunk.size
            if (chunk.size === 0) break;
            yield chunk;
            if (chunk.size !== chunkSize || (limit !== undefined && limit <= 0)) break;
            chunk = await cacheManager.fetch({ limit: chunkSize, after: chunk.lastKey() })
        }

    }

    /**
     * @template K, V 
     * @param {CachedManager<K, V>} cacheManager  
     * @param {number} [chunkSize] 
     * @param {number} [limit] 
     * @returns {Promise<Collection<K, V>>} 
     */
    static async completelyFetch(cacheManager, chunkSize=100, limit) {
        let results = new Collection()
        for await (const fetched of this.multiFetch(cacheManager, chunkSize, limit)) 
            results = results.concat(fetched)
        return results;
    }

    static userMention(userId, unknown="") {
        if (!userId) return unknown;
        return userMention(userId);
    }

}

module.exports = DiscordUtil;