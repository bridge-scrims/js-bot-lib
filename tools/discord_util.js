const { User, GuildMember, Guild, Collection, userMention } = require("discord.js");

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

    /**
     * @param {string} resolvable 
     * @param {import('../database/user_profile')[]} profiles 
     * @param {Guild} guild 
     * @returns {import('../database/user_profile')|GuildMember|null}
     */
    static parseUser(resolvable, profiles, guild) {
        resolvable = resolvable.replace(/```|:|\n|@/g, '')
        
        let matches = profiles.filter(user => [user.user_id, user.tag, user.username].includes(resolvable))
        if (matches.length === 1) return matches[0];

        if (guild) {
            const members = Array.from(guild.members.cache.values())
            matches = members.filter(user => user.displayName === resolvable)
            if (matches.length === 1) return matches[0].user;

            matches = members.filter(m => m.user.tag === resolvable)
            if (matches.length === 1) return matches[0].user;
        }

        // Same as above but everything to lower case
        resolvable = resolvable.toLowerCase()

        matches = profiles.filter(user => [user.user_id, user.tag, user.username].map(v => v.toLowerCase()).includes(resolvable))
        if (matches.length === 1) return matches[0];

        if (guild) {
            const members = Array.from(guild.members.cache.values())
            matches = members.filter(user => user.displayName.toLowerCase() === resolvable)
            if (matches.length === 1) return matches[0].user;

            matches = members.filter(m => m.user.tag.toLowerCase() === resolvable)
            if (matches.length === 1) return matches[0].user;
        }

        return null;
    }

}

module.exports = DiscordUtil;