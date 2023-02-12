const { Interaction, InteractionType, DiscordAPIError, MessageFlags, ModalBuilder } = require("discord.js");

const MessageOptionsBuilder = require("../../tools/payload_builder");
const LocalizedError = require("../../tools/localized_error");
const I18n = require("../../tools/internationalization");
const UserError = require("../../tools/user_error");

const UserProfile = require("../../database/user_profile");
const DBClient = require("../../postgresql/database");
const Position = require("../../database/position");

class CommandHandler {

    constructor(installer) {

        /** @type {import("../commands.js")} */
        this.installer = installer

        this.handler = (interaction) => this.handleInteraction(interaction).catch(console.error)
        this.handlers = {}

    }

    get bot() {
        return this.installer.bot;
    }

    get database() {
        return this.bot.database;
    }

    addHandler(id, handler) {
        this.handlers[id] = handler
    }

    /**
     * @typedef ExpandedInteractionData
     * @property {I18n} i18n
     * @property {import('../bot')} client
     * @property {import('../../postgresql/database')} database
     * 
     * @property {import("../permissions").PermissibleUser} user
     * @property {import('../../database/user_profile')} userProfile
     * @property {import('../../database/collections/user_permissions')} userPermissions
     * @property {(pos: Position.PositionResolvable) => boolean} userHasPosition
     * @property {(perms: import("../permissions").Permissions) => import("../permissions").UserPermissionInfo | false | undefined} userHasPermissions
     * @property {import("../permissions").PermissibleMember} member
     * 
     * @property {string} path
     * @property {string[]} args
     * @property {?string} commandName
     * @property {?string} subCommandName
     * @property {import("../commands.js").CommandConfig} [commandConfig]
     * @property {(payload: InteractionsReturnable) => Promise<void>} return
     */

    /** 
     * @param {Interaction} interaction
     * @returns {Promise<Interaction & ExpandedInteractionData>}
     */
    async expandInteraction(interaction) {
        
        interaction.database = this.database
        interaction.i18n = I18n.getInstance(interaction.locale)

        if (interaction.type === InteractionType.MessageComponent || interaction.type === InteractionType.ModalSubmit) 
            this.expandComponentInteraction(interaction)
        interaction.commandConfig = this.installer.getCommandConfig(interaction.commandName) ?? {}

        if (interaction.options) interaction.subCommandName = interaction.options.getSubcommand(false) ?? null
        
        interaction.path = `${interaction.commandName}`
        if (interaction.subCommandName) interaction.path += `/${interaction.subCommandName}`

        interaction.return = (...a) => this.interactionReturn(interaction, ...a)

        if (interaction.commandName === "CANCEL" && interaction.type === InteractionType.MessageComponent) 
            throw new LocalizedError('operation_cancelled')

        if (interaction.commandConfig?.forceGuild && !interaction.guild)
            throw new LocalizedError('command_handler.guild_only')

        await this.bot.profileUpdater?.ensureProfile(interaction.user)?.catch(console.error)
        interaction.userProfile = this.database.users.cache.find({ user_id: interaction.user.id }) || UserProfile.resolve(interaction.user)
        interaction.userPermissions = await this.bot.permissions.fetchUserPermissions(interaction.user.id)
        this.bot.permissions.permissifyUser(interaction.user, interaction.userPermissions)  

        interaction.userHasPermissions = (permissions) => this.bot.permissions.hasPermission(interaction.user.id, interaction.userPermissions, interaction.member, permissions)
        interaction.userHasPosition = (position) => this.bot.permissions.hasPosition(interaction.user.id, interaction.userPermissions, position)

        if (interaction.member) {
            this.bot.permissions.permissifyMember(interaction.member, interaction.userPermissions)
        }
        
        if (!this.isPermitted(interaction)) throw new LocalizedError('command_handler.missing_permissions')

    }

    /** @param {Interaction} interaction */
    getHandler(interaction) {
        const handler = this.handlers[interaction.commandName]
        if (handler) return handler;
        if (interaction.type === InteractionType.MessageComponent) throw new LocalizedError('command_handler.no_host')
        throw new LocalizedError('command_handler.missing_handler')
    }

    /** @param {Interaction} interaction */
    async handleInteraction(interaction) {
        try {

            if (interaction.customId?.startsWith('_')) return;

            const config = this.installer.getCommandConfig(interaction.commandName || interaction.customId?.split("/")?.[0]) ?? {}
            if (interaction.type !== InteractionType.ApplicationCommandAutocomplete) {
                if (config?.defer === 'reply') await interaction.deferReply()
                if (config?.defer === 'ephemeral_reply') await interaction.deferReply({ ephemeral: true })
                if (config?.defer === 'update') await interaction.deferUpdate()
            }

            await this.expandInteraction(interaction)
            const handler = this.getHandler(interaction)
            await handler(interaction)

        }catch(error) {
            await this.handleInteractionError(interaction, error)
        }
    }

    async handleInteractionError(interaction, error) {
        if (![10062].includes(error.code)) {
            if (!(error instanceof UserError) && !(error instanceof LocalizedError))
                console.error(`Unexpected error while handling a command!`, error)

            if (interaction.type !== InteractionType.ApplicationCommandAutocomplete && interaction.i18n && interaction.return) {
                const payload = this.getErrorPayload(interaction.i18n, error)
                await interaction.return(payload).catch(() => null)
            }
        }
    }

    /**
     * @param {I18n} i18n 
     * @param {Error} error
     */
    getErrorPayload(i18n, error) {
        if (error instanceof DiscordAPIError) error = new LocalizedError("unexpected_error.discord") 
        if (error instanceof DBClient.Error) error = new LocalizedError("unexpected_error.database")
        if (error instanceof LocalizedError) return error.toMessagePayload(i18n);
        if (error instanceof UserError) return error.toMessage();
        return (new LocalizedError("unexpected_error.unknown")).toMessagePayload(i18n);
    }

    expandComponentInteraction(interaction) {
        interaction.args = interaction.customId.split("/") ?? []
        interaction.commandName = interaction.args.shift() ?? null 
        interaction.subCommandName = interaction.args[0] ?? null 
    }

    /** @param {ExpandedInteractionData} interaction */
    isPermitted(interaction) {
        if (!interaction.commandConfig?.permissions) return true;
        return interaction.userHasPermissions(interaction.commandConfig.permissions);
    }

    /**
     * @typedef {import("discord.js").BaseMessageOptions|MessageOptionsBuilder|ModalBuilder|import("discord.js").ApplicationCommandOptionChoiceData[]} InteractionsReturnable
     */

    /** 
     * @param {Interaction} interaction
     * @param {InteractionsReturnable} payload
     */
    async interactionReturn(interaction, payload) {
        if (interaction.type === InteractionType.ApplicationCommandAutocomplete) {
            await interaction.respond(payload)
        }else if (payload instanceof ModalBuilder) {
            if (interaction.type !== InteractionType.ModalSubmit)
                if (!interaction.replied && !interaction.deferred)
                    await interaction.showModal(payload)
        }else {
            const forceEphemeral = payload.ephemeral
            const isEphemeral = interaction.message?.flags?.has(MessageFlags.Ephemeral)
            if (interaction.deferred && !interaction.replied && !isEphemeral && forceEphemeral) return interaction.followUp(payload)
            if (interaction.replied || interaction.deferred) return interaction.editReply(payload);
            if (isEphemeral) return interaction.update(payload);
            return interaction.reply(payload);
        }
    }

}

/** @typedef {ExpandedInteractionData} ExpandedInteractionData */

module.exports = CommandHandler;