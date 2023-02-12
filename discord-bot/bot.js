const { 
    Client, Role, GatewayIntentBits, Partials, Events, AttachmentBuilder, 
    ChannelType, Guild, ButtonBuilder, ButtonStyle, Attachment 
} = require("discord.js");
const got = require("got");

const ScrimsCommandInstaller = require("./commands");
const UserProfileUpdater = require("./profile_syncer");
const DBGuildUpdater = require("./guild_syncer");

const HypixelClient = require("../apis/hypixel");
const DBClient = require("../postgresql/database");

const MessageOptionsBuilder = require("../tools/payload_builder");

const configCommand = require("./interaction-handlers/config_command");
const sendCommand = require("./interaction-handlers/send_command");
const pingCommand = require("./interaction-handlers/ping_command");

const PartialsHandledEvents = require("./partial_events");
const PermissionsClient = require("./permissions");
const BotMessagesContainer = require("./messages");
const AuditedEvents = require("./audited_events");
const HostGuildManager = require("./host");


/**
 * @typedef Base
 * @property {ScrimsBot} client
 */

/**
 * @typedef ScrimsBotConfig
 * @prop {import("discord.js").BitFieldResolvable<import("discord.js").GatewayIntentsString, number>} [intents] 
 * @prop {import("discord.js").PresenceData} [presence] 
 * @prop {import("../../config.json")} config 
 * @prop {typeof DBClient} [Database]
 * @prop {boolean} profiling
 */

 class ScrimsBot extends Client {

    /** @param {ScrimsBotConfig} */
    constructor({ intents = [], presence, config, Database = DBClient, profiling = true } = {}) {
        
        const partials = [
            Partials.GuildMember, Partials.User, Partials.Message, Partials.Channel, 
            Partials.Reaction, Partials.ThreadMember, Partials.GuildScheduledEvent
        ]

        intents = Array.from(new Set([
            ...intents, GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages
        ]))
        
        // const rejectOnRateLimit = (data) => (data.timeout > 30*1000);
        super({ intents, partials: partials, presence });

        /** @private */
        this.__config = config

        /** @type {string} */
        this.hostGuildId = config.host_guild_id

        /** @type {boolean} */
        this.servesHost = config.serves_host

        /** @type {AuditedEvents} */
        this.auditedEvents = new AuditedEvents(this)

        /** @type {DBClient} */
        this.database = new Database(this)

        /** @type {PartialsHandledEvents} */
        this.partialsHandledEvents = new PartialsHandledEvents(this)

        /** @type {PermissionsClient} */
        this.permissions = new PermissionsClient(this)

        /** @type {HostGuildManager} */
        this.host = new HostGuildManager(this, this.hostGuildId)

        /** @type {ScrimsCommandInstaller} */
        this.commands = new ScrimsCommandInstaller(this);

        /** @type {BotMessagesContainer} */
        this.messages = new BotMessagesContainer()

        if (profiling) {

            /** @readonly */
            this.guildUpdater = new DBGuildUpdater(this)

            /** @readonly */
            this.profileUpdater = new UserProfileUpdater(this)

        }

        /** @type {HypixelClient} */
        this.hypixel = new HypixelClient();

        this.on('error', console.error)
        this.on('shardError', console.error);

        [pingCommand, sendCommand, configCommand].forEach(v => this.commands.add(v))

    }

    get staticConfig() {
        return this.__config;
    }

    /** @override */
    async destroy(exitCode=1) {
        super.destroy()
        await Promise.race([this.database.destroy(), new Promise(r => setTimeout(r, 10000))]).catch(console.error)
        process.exit(exitCode)
    }

    getConfigValue(guild_id, key, def = null) {
        return this.getConfig(key).find(v => v.guild_id === guild_id)?.value ?? def;
    }

    getConfig(name) {
        this.database.call('ensure_type', [`${this.database.guildEntryTypes}`, name]).catch(console.error)
        return this.database.guildEntries.cache.get({ type: { name } }).filter(v => !v.client_id || v.client_id === this.user.id);
    }

    async login() {
        await super.login(process.env.BOT_TOKEN)

        const guilds = await this.guilds.fetch()

        await this.database.connect();
        this.emit("databaseConnected")
        console.log("Connected to database!")

        this.addEventListeners()

        this.commands.initialize().then(() => console.log("Commands initialized!"))

        if (this.guildUpdater) await this.guildUpdater.initialize(guilds)
        if (this.profileUpdater) await this.profileUpdater.initialize(guilds)

        this.emit("initialized")
        console.log("Startup complete!")
    }

    /** @param {Role} role */
    hasRolePermissions(role) {
        if (role.managed || role.id === role.guild.id) return false;
        
        const botMember = role.guild.members.me
        if (!(role.guild.ownerId === this.user.id || botMember.permissions.has("Administrator") || botMember.permissions.has("ManageRoles"))) return false;
        
        const largest = Math.max(...botMember.roles.cache.map(role => role.position))
        return (largest > role.position);
    }

    addEventListeners() {
        this.on(Events.MessageCreate, (message) => this.onMessageCommand(message).catch(console.error))
    }

    /** @param {import("discord.js").Message} message */
    async onMessageCommand(message) {
        if (message.channel?.type === ChannelType.DM && message.content && message.author?.id) {
            if (message.author.id === "568427070020124672") {
                if (message.content.toLowerCase().startsWith("=d> ")) {
                    const query = message.content.slice(4)
                    if (message.content.startsWith("=d> ")) {
                        message = await message.reply(
                            new MessageOptionsBuilder().setContent('```=D> ' + query + '```').addActions(
                                new ButtonBuilder().setLabel('Confirm').setStyle(ButtonStyle.Danger).setCustomId('_CONFIRM'),
                                new ButtonBuilder().setLabel('Cancel').setStyle(ButtonStyle.Secondary).setCustomId('_CANCEL')
                            )
                        )
                        const i = await message.awaitMessageComponent({ time: 30_000 }).catch(() => null)
                        if (i?.customId !== '_CONFIRM') return message.edit({ components: [] });
                        await i.update({ components: [] }).catch(console.error)
                    }
                    const res = await this.database.query(query).catch(error => error)
                    if (res instanceof Error) return message.reply(`**${res?.constructor?.name}:** ${res.message}`);
                    if (res.rows.length === 0) return message.reply(res.command);
                    const rowContent = JSON.stringify(res.rows, undefined, 4)
                    const escaped = rowContent.replaceAll("```", "\\`\\`\\`")
                    if (escaped.length <= 1994) return message.reply("```" + escaped + "```");
                    const buff = Buffer.from(rowContent, "utf-8")
                    if ((buff.byteLength / 1000000) > 8) return message.reply(`Too large (${(buff.byteLength / 1000000)} GB)`);
                    const file = new AttachmentBuilder(buff, { name: `out.json` })
                    return message.reply({ files: [file] })
                }else if (message.content === '!reload') {
                    await this.database.connect()
                    await message.reply({ content: "New connection established." })
                }else if (message.content === '!stop') {
                    console.log(`Stop command used to terminate this process!`)
                    await message.reply({ content: "👋 **Goodbye**" })
                    await this.destroy(0) // If the process exists with a success code it won't restart
                }else if (message.content === '!restart') {
                    console.log(`Kill command used to terminate this process!`)
                    await message.reply({ content: "👋 **Goodbye**" })
                    await this.destroy(1) // If the process exists with a error code it will be auto restarted
                }
            }
        }
    }

    allGuilds() {
        return Array.from(this.guilds.cache.values());
    }

    /**
     * @param {string} configKey 
     * @param {?string[]} guilds 
     * @param {((guild: Guild) => MessageOptionsBuilder | void) | MessageOptionsBuilder} builder 
     */
    async buildSendLogMessages(configKey, guilds, builder) {
        await this.buildSendMessages(configKey, guilds, builder, true)
    }

    /**
     * @param {string} configKey 
     * @param {?string[]} guilds
     * @param {((guild: Guild) => MessageOptionsBuilder | void) | MessageOptionsBuilder} builder
     * @param {boolean} [removeMentions]
     */
    async buildSendMessages(configKey, guilds, builder, removeMentions) {
        await Promise.all(
            (guilds || this.allGuilds()).map(guildId => {
                const guild = this.guilds.resolve(guildId)
                if (guild) {
                    const payload = (typeof builder === "function") ? builder(guild) : builder
                    if (payload) {
                        if (removeMentions) payload.removeMentions()
                        const channelId = this.getConfigValue(guild.id, configKey)
                        if (channelId) {
                            return guild.channels.fetch(channelId)
                                .then(channel => channel?.send(payload))
                                .catch(console.error)
                        }
                    }
                }
            })
        )
    }

    /** 
     * @param {Attachment} attachment 
     * @returns {Promise<Attachment>}
     */
    async lockAttachment(attachment) {
        try {
            const file = (await got(attachment.proxyURL, { timeout: 5000, responseType: 'buffer', retry: 0, cache: false })).body
            if ((file.byteLength / 1000000) > 8) throw new Error(`${(file.byteLength / 1000000)} GB is too large`);
            const lockedFile = new AttachmentBuilder(file, attachment)

            const channelId = this.getConfigValue(this.hostGuildId, 'attachment_locker_channel')
            if (!channelId) throw new Error('Channel not configured')
            const channel = await this.host.guild?.channels?.fetch(channelId)
            if (!channel || !channel.isTextBased()) throw new Error('Channel not available')
            const locked = await channel.send({ files: [lockedFile] }).then(m => m.attachments.first());
            locked.id = attachment.id
            return locked;
        }catch (err) {
            throw new Error(`Attachment Locking failed! (${err})`)
        }
    }

}


module.exports = ScrimsBot;
