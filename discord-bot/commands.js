const { ApplicationCommand, Collection, Events, ContextMenuCommandBuilder, SlashCommandBuilder, Guild, ApplicationCommandPermissionType } = require('discord.js');
const CommandHandler = require('./interaction-handlers/commands');

/**
 * @typedef CommandConfig
 * @prop {import('./permissions').Permissions} [permissions]
 * @prop {string[]} [guilds]
 * @prop {boolean} [singleHosted]
 * @prop {boolean} [avoidHost]
 * @prop {boolean} [forceGuild]
 * @prop {'update' | 'reply' | 'ephemeral_reply'} [defer]
 * 
 * @typedef {ContextMenuCommandBuilder | SlashCommandBuilder} CommandBuilder
 * 
 * @typedef Command
 * @prop {string | CommandBuilder} command
 * @prop {(interaction:import('discord.js').Interaction) => Promise<any>} handler
 * @prop {CommandConfig} [config]
 */

class CommandInstaller {

    constructor(bot) {

        Object.defineProperty(this, "bot", { value: bot })

        /** 
         * @readonly
         * @type {import("./bot")} 
         */
        this.bot

        /** @type {CommandHandler} */
        this.handler = new CommandHandler(this)

        /** @type {CommandBuilder[]} **/
        this.commandBuilders = []

        /** @type {Collection<string, ApplicationCommand>} **/
        this.appCommands = []

        /** @type {Object.<string, CommandConfig>} */
        this.configurations = {}

        /** @type {Command[]} */
        this.commands = []

        this.bot.on(Events.GuildCreate, () => this.update().catch(console.error))

    }

    async initialize() {
        this.install()
        this.bot.off(Events.InteractionCreate, this.handler.handler)
        this.bot.on(Events.InteractionCreate, this.handler.handler)
        this.appCommands = await this.bot.application.commands.fetch({ withLocalizations: true })
        await this.update()
    }

    async update() {
        await this.updateCommands()
    }

    /** @param {Command} command */
    add(command) {
        this.commands.push(command)
    }

    /** @protected */
    install() {
        this.commands.forEach(cmd => this._install(cmd))
        this.commands = []
    }

    /** 
     * @protected
     * @param {Command} 
     */
    _install({ command, handler, config }) {
        
        if (typeof command !== "string") {

            const options = command.options
        
            // Important so that we can tell if the command changed or not
            if (options) options.filter(option => (!option.type)).forEach(option => option.type = 1)
            if (options) options.filter(option => option.options === undefined).forEach(option => option.options = [])

            command.setDMPermission(!config.forceGuild)
            this.commandBuilders.push(command)

        }

        const id = command?.name ?? command
        this.handler.addHandler(id, handler)
        this.configurations[id] = config ?? {}

    }

    getCommandBuilder(name) {
        return this.commandBuilders.find(v => v.name === name) ?? null;
    }

    getCommandConfig(name) {
        return this.configurations[name];
    }

    async updateCommands() {

        // UPDATING
        await Promise.all(this.appCommands.map(appCmd => this.updateAppCommand(appCmd)))
        await Promise.all(this.commandBuilders.map(builder => this.addAppCommand(builder, this.appCommands)))

        for (const guild of this.bot.guilds.cache.values()) {
            const commands = await guild.commands.fetch({ withLocalizations: true })
            await Promise.all(commands.map(appCmd => this.updateAppCommand(appCmd, guild.id)))
            await Promise.all(this.commandBuilders.map(builder => this.addAppCommand(builder, commands, guild.id)))
        }

        // RELOADING
        this.appCommands = await this.bot.application.commands.fetch({ withLocalizations: true })
        
    }

    /** @param {string[]} guilds */
    isAllGuilds(guilds) {
        return (this.bot.guilds.cache.size === guilds.length)
            && (this.bot.guilds.cache.every(v => guilds.includes(v.id)))
    }

    /** @param {CommandConfig} */
    getGuilds({ singleHosted, avoidHost, guilds } = {}) {
        if (guilds) return guilds;
        const allGuilds = Array.from(this.bot.guilds.cache.map(guild => guild.id))
        return allGuilds.filter(id => id !== this.bot.hostGuildId || ((!singleHosted || this.bot.servesHost) && !avoidHost))
    }

    async updateAppCommand(appCmd, guildId) {

        const config = this.getCommandConfig(appCmd.name)
        const guilds = this.getGuilds(config)
        const builder = this.getCommandBuilder(appCmd.name)

        if (appCmd) {
            if (builder && ((!guildId && this.isAllGuilds(guilds)) || guilds.includes(guildId)) && !(this.isAllGuilds(guilds) && guildId)) {
                // Important so that we can tell if the command changed or not
                if (appCmd.options) appCmd.options.filter(option => option.options === undefined).forEach(option => option.options = [])
                if (!appCmd.equals(builder))
                    // update command
                    await this.bot.application.commands.edit(appCmd.id, builder, guildId)
                        .catch(error => console.error(`Unable to edit app command with id ${appCmd.id}!`, builder, error))
            }else {
                await this.bot.application.commands.delete(appCmd.id, guildId)
                    .catch(error => console.error(`Unable to delete app command with id ${appCmd.id}!`, error))
            }
        }

    }

    async addAppCommand(builder, commands, guildId) {

        const config = this.getCommandConfig(builder.name)
        const guilds = this.getGuilds(config)

        if (this.isAllGuilds(guilds) && guildId) return false;
        if (!((this.isAllGuilds(guilds) && !guildId) || guilds.includes(guildId))) return false;
        if (commands.find(cmd => cmd.name === builder.name)) return false;

        await this.bot.application.commands.create(builder, guildId)
            .catch(error => console.error(`Unable to create app command!`, builder, error))

    }

    /**
     * This needs a special token with the `applications.commands.permissions.update` scope.
     * @param {Guild} guild
     * @param {string} token
     */
    async setGuildCommandsPermissions(guild, token) {
        await guild.commands.permissions.set({ token, permissions: [{ id: guild.id, permission: true, type: ApplicationCommandPermissionType.Role }] })
        const commands = await guild.commands.fetch().then(v => [ ...v.values(), ...this.appCommands.values() ])
        await Promise.all(commands.map(appCmd => this.updateCommandPermissions(guild, appCmd, token))).catch(console.error)
    }

    /**
     * @param {Guild} guild 
     * @param {import('./permissions').Permissions} perms
     */
    getCommandPermissionsGuildCommandPermissions(guild, perms = {}) {
        const roles = this.bot.permissions.getPermissionRoles(guild.id, perms)
        return roles.map(roleId => ({ id: roleId, permission: true, type: ApplicationCommandPermissionType.Role }))
            .concat((perms.allowedUsers ?? [])
            .map(userId => ({ id: userId, permission: true, type: ApplicationCommandPermissionType.User })))
    }

    /**
     * @param {Guild} guild 
     * @param {ApplicationCommand} appCmd
     * @param {string} token
     */
    async updateCommandPermissions(guild, appCmd, token) {

        const config = this.getCommandConfig(appCmd.name)
        const permissions = this.getCommandPermissionsGuildCommandPermissions(guild, config.permissions)

        const existingPerms = await appCmd.permissions.fetch({ command: appCmd.id, guild: guild.id }).catch(() => null)

        // Permissions have not changed so just leave it
        if (!existingPerms && permissions.length === 0) return true;
        if ((JSON.stringify(existingPerms) == JSON.stringify(permissions))) return true;
        
        // Can not block the command client side, since discord only allows up to 10 permissions
        if (permissions.length === 0 || permissions.length > 10) {

            await appCmd.permissions.set({ token, command: appCmd.id, guild: guild.id, permissions: [] })
                .catch(error => console.error(`Unable to set permissions for command ${appCmd.name}/${appCmd.id}/${guild.id} to none!`, error))
            
            return false; 

        }

        // Set command permissions
        await appCmd.permissions.set({ token, command: appCmd.id, guild: guild.id, permissions })
            .catch(error => console.error(`Unable to set permissions for command ${appCmd.name}/${appCmd.id}/${guild.id}!`, permissions, error))

    }

}

module.exports = CommandInstaller;