const { Guild, ChannelType, CategoryChannel } = require("discord.js");

const MAX_CHANNELS = 50

/**
 * @param {Guild} guild
 * @param {?string} parent
 * @param {import("discord.js").GuildChannelCreateOptions[]} channels 
 */
async function categoryLimitSafeCreate(guild, parent, channels) {
    if (channels.length === 0) return [];
    if (!parent) return createChannels(guild, parent, channels)
    const category = await guild.channels.fetch(parent)
    if (category?.type !== ChannelType.GuildCategory) throw new Error(`Invalid parent provided: ${category?.type}!`)
    const extraCategories = Math.ceil((channels.length - (MAX_CHANNELS - category.children.cache.size)) / 50)
    const categories = [
        category, 
        ...(await Promise.all(Array.from(new Array(extraCategories)).map((_, i) => copyCategory(category, i + 2))))
    ]
    return Promise.all(
        categories.map((parent) => createChannels(guild, parent.id, channels.splice(0, (MAX_CHANNELS - parent.children.cache.size))))
    ).then(v => v.flat())
}

/**
 * @param {CategoryChannel} category
 * @param {string} id
 */
async function copyCategory(category, id) {
    return category.guild.channels.create({
        name: `${category.name} ${id}`, type: category.type,
        position: (category.position + 1)
    })
}

/**
 * @param {Guild} guild
 * @param {?string} parent 
 * @param {import("discord.js").GuildChannelCreateOptions[]} channels
 * @returns {Promise<(import("discord.js").GuildBasedChannel|void)[]>}
 */
async function createChannels(guild, parent, channels) {
    return Promise.all(
        channels.map(
            v => guild.channels.create({ ...v, parent })
                .catch(err => console.error(`Couldn't create ${v.name} channel: ${err}!`))
        )
    )
}

module.exports = categoryLimitSafeCreate