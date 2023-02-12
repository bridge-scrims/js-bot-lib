const { Links, Emojis, Colors } = require('./tools/constants');

/**
 * @typedef {import('./discord-bot/commands').Command} Command
 * @typedef {import('./discord-bot/interaction-handlers/commands').ExpandedInteractionData} ExpandedInteraction
 * @typedef {import('discord.js').ContextMenuCommandInteraction & ExpandedInteraction} ContextMenuInteraction
 * @typedef {import('discord.js').ChatInputCommandInteraction & ExpandedInteraction} SlashCommandInteraction
 * @typedef {import('discord.js').MessageComponentInteraction & ExpandedInteraction} ComponentInteraction
 * @typedef {import('discord.js').AutocompleteInteraction & ExpandedInteraction} AutocompleteInteraction
 * @typedef {import('discord.js').ModalSubmitInteraction & ExpandedInteraction} ModalSubmitInteraction
 */

module.exports = {
    Links, Emojis, Colors,
    
    I18n: require('./tools/internationalization'),
    LocalizedError: require('./tools/localized_error'),
    UserError: require('./tools/user_error'),
    MessageOptionsBuilder: require('./tools/payload_builder'),

    DiscordUtil: require('./tools/discord_util'),
    ColorUtil: require('./tools/color_util'),
    TextUtil: require('./tools/text_util'),
    TimeUtil: require('./tools/time_util')
}