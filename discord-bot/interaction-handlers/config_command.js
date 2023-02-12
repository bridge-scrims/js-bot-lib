const { InteractionType, EmbedBuilder, AutocompleteInteraction, ChatInputCommandInteraction } = require('discord.js');

const { LocalizedSlashCommandBuilder } = require('../tools/localized_builders');
const MessageOptionsBuilder = require('../../tools/payload_builder');
const LocalizedError = require('../../tools/localized_error');

const GuildEntry = require('../../database/guild_entry');

const OPTIONS = {
    Key: "key",
    Value: "value",
    Client: "client"
}

/** @param {AutocompleteInteraction & import('./commands').ExpandedInteractionData} interaction */
async function onConfigAutocomplete(interaction) {
    const focused = interaction.options.getFocused(true)
    const choices = (() => {
        if (focused.name === OPTIONS.Key) 
            return [{ name: "Read All", value: -1 }]
                .concat(interaction.database.guildEntryTypes.cache.values().map(v => ({ name: v.titleName, value: v.id_type })));
        if (focused.name === OPTIONS.Client)
            return interaction.guild.members.cache.filter(m => m.user.bot).map(v => ({ name: v.displayName, value: v.id }));
        return [];
    })()
    await interaction.respond(
        choices
            .filter(({ name }) => name.toLowerCase().includes(focused.value.toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name))
            .slice(0, 25)
    )
}

/** @param {ChatInputCommandInteraction & import('./commands').ExpandedInteractionData} interaction */
async function onConfigCommand(interaction) {
    if (interaction.type === InteractionType.ApplicationCommandAutocomplete) return onConfigAutocomplete(interaction);
    
    const entrySelector = { guild_id: interaction.guildId }
    const id_type = interaction.options.get(OPTIONS.Key).value
    if (id_type === -1) {
        const guildConfig = await interaction.database.guildEntries.sqlFetch(entrySelector)
        return interaction.editReply(
            new MessageOptionsBuilder()
                .createMultipleEmbeds(
                    guildConfig.filter(v => v.value).sort((a, b) => a.type.name.localeCompare(b.type.name)),
                    (entries) => (
                        new EmbedBuilder()
                            .setTitle("Guild Configuration")
                            .setColor("#00d8ff")
                            .setDescription(
                                entries.map(v => `\`•\` **${v.type.titleName}:** ${v.value}${(v.client_id ? ` (<@${v.client_id}>)` : "")}`).join("\n")
                            )
                    )
                )
        )
    }
    
    const type = interaction.database.guildEntryTypes.cache.resolve(id_type)
    if (!type) throw new LocalizedError("type_error.config_key")
    entrySelector.id_type = type.id_type

    const entries = await interaction.database.guildEntries.sqlFetch(entrySelector)
    const _val = interaction.options.get(OPTIONS.Value)?.value
    const value = (_val?.toLowerCase() === "null" ? null : _val)

    const client_id = interaction.options.get(OPTIONS.Client)?.value ?? null
    let entry = entries.find(v => v.client_id === client_id)
    const oldValue = entry?.value ?? null

    if (_val === undefined || value === oldValue) {
        if (entries.length > 1) 
            return interaction.editReply({ content: entries.map(v => `\`•\` ${v.value}${(v.client_id ? ` (<@${v.client_id}>)` : "")}`).join("\n") }) 
        return interaction.editReply({ content: `${entries[0]?.value ?? "NULL"}` }) 
    }

    if (entry) {
        if (value === null) await interaction.database.guildEntries.delete(entry)
        else await interaction.database.guildEntries.update(entry, { value })
    }else {
        entry = await interaction.database.guildEntries.create(
            new GuildEntry(interaction.database)
                .setGuild(interaction.guild).setType(type).setValue(value).setClient(client_id)
        )
    }

    await interaction.editReply({ content: `${oldValue} **->** ${value}${(client_id ? ` (<@${client_id}>)` : "")}` })
}

/** @type {import('../commands').Command} */
module.exports = {
    command: (
        new LocalizedSlashCommandBuilder()
            .setName("commands.config.name").setDescription("commands.config.description")
            .addIntegerOption((option) =>
                option
                    .setName(OPTIONS.Key)
                    .setNameLocalizations("commands.config.key_option.name")
                    .setDescription("commands.config.key_option.description")
                    .setAutocomplete(true)
                    .setRequired(true)
            )
            .addStringOption((option) => (
                option
                    .setName(OPTIONS.Value)
                    .setNameLocalizations("commands.config.val_option.name")
                    .setDescription("commands.config.val_option.description")
                    .setRequired(false)
            ))
            .addStringOption((option) => (
                option
                    .setName(OPTIONS.Client)
                    .setNameLocalizations("commands.config.client_option.name")
                    .setDescription("commands.config.client_option.description")
                    .setAutocomplete(true)
                    .setRequired(false)
            ))
    ),
    handler: onConfigCommand,
    config: { 
        permissions: { positionLevel: "owner" },
        forceGuild: true, defer: 'ephemeral_reply', singleHosted: true
    }
}