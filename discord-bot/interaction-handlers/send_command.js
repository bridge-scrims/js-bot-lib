const { InteractionType, AutocompleteInteraction, ChatInputCommandInteraction } = require('discord.js');
const { LocalizedSlashCommandBuilder } = require('../tools/localized_builders');
const LocalizedError = require('../../tools/localized_error');

const Options = {
    Message: "message"
}

/**
 * @param {AutocompleteInteraction & import('./commands').ExpandedInteractionData} interaction
 */
async function onSendAutocomplete(interaction) {
	const focused = interaction.options.getFocused().toLowerCase()
	await interaction.respond(
		(await interaction.client.messages.getIdentifiers(interaction.member))
            .filter(name => name.toLowerCase().includes(focused))
            .map(name => ({ name, value: name })).slice(0, 25)
	)
}

/** @param {ChatInputCommandInteraction & import('./commands').ExpandedInteractionData} interaction */
async function onSendCommand(interaction) {
	if (interaction.type === InteractionType.ApplicationCommandAutocomplete) return onSendAutocomplete(interaction);
	const messageId = interaction.options.getString(Options.Message)
	const message = await interaction.client.messages.get(messageId, interaction.member)
	if (!message) throw new LocalizedError("bot_message_missing", messageId)
	await interaction.channel.send(message)
	await interaction.editReply({ content: "Your message was sent." })
}

/** @type {import('../commands').Command} */
module.exports = {
    command: new LocalizedSlashCommandBuilder()
        .setNameAndDescription("commands.send")
        .addStringOption(
            (o) => o
                .setNameAndDescription('commands.send.message_option')
                .setName(Options.Message)
                .setAutocomplete(true)
                .setRequired(true)
        ),
    handler: onSendCommand, 
    config: { forceGuild: true, defer: 'ephemeral_reply', singleHosted: true } 
}