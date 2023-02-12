const { SlashCommandBuilder, ChatInputCommandInteraction } = require("discord.js")

/** @param {ChatInputCommandInteraction & import("./commands").ExpandedInteractionData} interaction */
async function onPingCommand(interaction) {
	await interaction.editReply({ content: "pong" })
}

/** @type {import("../commands").Command} */
module.exports = {
    command: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Used to test the bots connection."),
    handler: onPingCommand,
    config: { defer: 'ephemeral_reply' }
}