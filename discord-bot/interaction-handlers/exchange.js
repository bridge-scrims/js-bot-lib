const { 
    ModalBuilder, ActionRowBuilder, ComponentType, EmbedBuilder, InteractionType, 
    SnowflakeUtil, TextInputBuilder, ButtonBuilder, ButtonStyle, Message 
} = require("discord.js");

const MessageOptionsBuilder = require("../../tools/payload_builder");
const StateComponentHandler = require("./state_components");
const MojangClient = require("../../apis/mojang");

const DiscordUtil = require("../../tools/discord_util");
const TextUtil = require("../../tools/text_util");
const TimeUtil = require("../../tools/time_util");

/**
 * @typedef {'Text' | 'Users' | 'Country' | 'Offset' | 'McAccount' | 'URL'} InputFieldParseType
 * 
 * @typedef EphemeralExchangeInputFieldData
 * @property {string} label
 * @property {InputFieldParseType} parseType
 * @property {boolean} force
 * 
 * @typedef {import("discord.js").TextInputComponentData & EphemeralExchangeInputFieldData} EphemeralExchangeInputField
 */

class Parser {

    async parseDiscordUsers(guild, text) {
        if (!text) return [];
        text = text.replace(/\n/g, '@').replace(/```|:|discord/g, '')

        const profiles = guild.client.database.users.cache.values()
        const userResolvables = text.split('@').map(v => v.trim()).filter(v => v.length > 0).slice(0, 10)

        return userResolvables.map(resolvable => (DiscordUtil.parseUser(resolvable, profiles, guild)) ?? `${resolvable}`);
    }

    async parseMCAccount(ign) {
        return MojangClient.resolveIGN(ign);
    }
    
    /** @param {InputFieldParseType} type */
    async parseFieldValue(interaction, type, value) {
        if (type === 'Users') return this.parseDiscordUsers(interaction.guild, value);
        if (type === 'McAccount') return this.parseMCAccount(value);
        if (type === 'Text') return TextUtil.stripText(value);
        if (type === 'URL') return TextUtil.isValidHttpUrl(value) ? value : null;
        if (type === 'Offset') return TimeUtil.extractOffset(value);
        if (type === 'Country') return TimeUtil.parseCountry(value);
        return value;
    }
    
    /** @param {State} state */
    async parseModalComponents(state, interaction, components) {
        await Promise.all(
            components.map(async (partialField) => {
                const field = state.getFields().find(field => field.customId === partialField.customId)
                if (field) {
                    state.setFieldValue(
                        field, partialField.value, 
                        await this.parseFieldValue(interaction, field.parseType, partialField.value)
                    )
                }
            })
        )
    }

}

class StateManager {

    constructor(fields) {

        /** @type {EphemeralExchangeInputField[]} */
        this.fields = fields

    }

    /**
     * @param {Message<true>} previousResponse 
     * @returns {State}
     */
    recall(previousResponse) {
        const embed = previousResponse.embeds?.[0]
        const fields = embed?.fields
        if (!fields || !fields.length || this.fields.length < fields.length) return null;

        const state = this.default()
        state.index = Math.ceil(fields.length / 5)
        fields.forEach((field, i) => {
            const inputted = this.recallField(this.fields[i].parseType, field.value)
            state.setFieldValue(this.fields[i].customId, inputted, undefined)
        })
        return state;
    }

    /** 
     * @protected
     * @param {InputFieldParseType} type
     * @param {string} value
     */
    recallField(type, value) {

        value = /```(.*)```/.exec(value)?.[1] || value;

        if (type === 'McAccount' || type === 'Offset') return value.replace(/(\(.*\))/, "").trim();
        if (type === 'Users') 
            return value.split('\n')
                .map(v => /`•` (.+)/.exec(v)?.[1] || v)
                .map(v => /(.+?)( \(.*\))?/.exec(v)?.[1] || v)
                .map(v => `@${v}`).join(' ')

        return value;

    }

    default() {
        return new State(`${SnowflakeUtil.generate()}`, this.fields);
    }

}

/**
 * @typedef {State} ExchangeHandlerState
 */

class State {

    constructor(id, fields) {

        /** @type {string} */
        this.id = id

        /** @type {EphemeralExchangeInputField[]} */
        this.fields = fields

        /** @type {Object.<string, ({ value: any, parsed: any })>} */
        this.values = {}

        /** @type {number} */
        this.index = 0

    }

    reset() {
        this.index = 0
        Object.values(this.values).forEach(v => delete v.parsed)
        return this;
    }

    getFields() {
        return this.fields;
    }

    getFieldValue(customId) {
        return this.values[this.fields.find(v => v === customId || v.customId === customId)?.customId]?.parsed;
    }

    getFieldImputedValue(customId) {
        return this.values[this.fields.find(v => v === customId || v.customId === customId)?.customId]?.value;
    }

    setFieldValue(id, value, parsed) {
        const customId = this.fields.find(v => v === id || v.customId === id)?.customId
        if (customId) {
            this.values[customId] = { value, parsed }
        }
    }

    /** @param {InputFieldParseType} parseType */
    getModalComponentType(parseType) {
        return ComponentType.TextInput;
    }

    disableNext() {
        if (this.fields.every(field => this.getFieldValue(field) === undefined)) return true;
        return this.fields
            .filter(field => this.getFieldValue(field) !== undefined)
            .some(field => this.getFieldComment(field.parseType, this.getFieldValue(field), field.required, field.force))
    }

    /** @param {InputFieldParseType} type */
    getFieldComment(type, value, required, force) {

        if (type === 'Users' && required) {
            const resolved = value.filter(v => (v?.id || v?.user_id)).length
            if (resolved === 0 && force) return { name: `:no_entry:  Invalid Discord User(s)`, value: `Please verify that the User ID's/Tags are correct before continuing.` };
            if (resolved !== value.length) return { name: `:x:  Unresolved Discord User(s)`, value: "Please verify that the User ID's/Tags are correct before continuing." };
        }

        if (type === 'McAccount' && !value && required)
            return { name: `:x:  Invalid Minecraft Account`, value: "*Please correct this Minecraft username before continuing.*" };

        if (type === 'URL' && !value && required) 
            return { name: `:x:  Invalid URL`, value: "*Please correct this URL before continuing.*" };

        if (type === 'Country' && !value && required) 
            return { name: `:x:  Invalid Country`, value: "*Please input a valid country before continuing.*" };

        if (type === 'Offset' && typeof value !== "number" && required)
            return { name: `:x:  Invalid Time`, value: "*Please input a valid time before continuing.*" };

        return null;

    }

    /**
     * @param {InputFieldParseType} type
     * @returns {string}
     */
    stringifyFieldValue(type, value, inputted, required, force) {

        if (type === 'McAccount' && value)
            return `\`\`\`${value.name} (${value.id})\`\`\``;

        if (type === 'Users') 
            return ((value.length > 0) ? value.map(v => (v?.id || v?.user_id) ? `${v} (${v?.user_id ?? v?.id})` : `**${v.slice(0, 37)}**`).map(v => `\`•\` ${v}`).join("\n").slice(0, 1024) : `\`\`\` \`\`\``);
        
        if (type === 'Country' && value)
            return `\`\`\`${value.name.common}\`\`\``;

        if (type === 'Offset' && typeof value === 'number')
            return `\`\`\`${inputted} (${TimeUtil.stringifyOffset(value)})\`\`\``;

        return `\`\`\`${((typeof value === 'string') ? TextUtil.limitText(value, 1024-6) : inputted) || " "}\`\`\``;

    }
    
    getModalComponents() {
        const fields = this.getFields().slice(this.index*5, this.index*5+5).filter(v => v)
        if (fields.length === 0) return [];
        return fields.map(field => {
            const component = ({ ...field, type: this.getModalComponentType(field), value: this.getFieldImputedValue(field) })
            return new ActionRowBuilder().addComponents(new TextInputBuilder(component));
        });
    }

    getEmbedFields(showComments=false) {
        const fields = this.getFields()
            .filter(field => this.getFieldValue(field) !== undefined)
            .map(field => {
                const fields = [{
                    name: field.label,
                    value: this.stringifyFieldValue(field.parseType, this.getFieldValue(field), this.getFieldImputedValue(field), field.required, field.force).substring(0, 1024)
                }]
                const comment = this.getFieldComment(field.parseType, this.getFieldValue(field), field.required, field.force)
                if (comment && showComments) fields.push(comment)
                return fields;
            }).flat();
        return fields.slice((fields.length > 25) ? (fields.length - 25) : 0);
    }

}

/**
 * @typedef {import("discord.js").Interaction & import("./commands").ExpandedInteractionData & RecallExchangeInteractionData} RecallExchangeInteraction
 * @typedef RecallExchangeInteractionData
 * @property {ExchangeHandler} handler
 * @property {State} state
 */

/** @extends {StateComponentHandler<State>} */
class ExchangeHandler extends StateComponentHandler {

    /**
     * @param {string} title
     * @param {EphemeralExchangeInputField[]} fields 
     */
    constructor(customId, title, fields, getModalResponseCall, verifyCall, onFinish) {

        super(customId, (...args) => this.__getModalResponse(...args), verifyCall, new StateManager(fields), new Parser())

        /** @type {string} */
        this.title = title

        /** @type {EphemeralExchangeInputField[]} */
        this.fields = fields

        /** 
         * @protected
         * @type {getModalResponseCall} 
         */
        this.getModalResponseCall = getModalResponseCall

        /** @protected */
        this.onFinish = onFinish

    }

    get length() {
        return Math.ceil(this.fields.length / 5);
    }

    /** 
     * @protected
     * @override 
     */
    getNextButton(state, ...args) {
        if ((state.index + 1) < this.length) return super.getNextButton(state, ...args).setDisabled(state.disableNext());
        return new ButtonBuilder()
            .setLabel('Submit').setCustomId(`${this.getCustomId(state)}/NEXT`).setDisabled(state.disableNext()).setStyle(ButtonStyle.Success).setEmoji("📨");

    }

    /** @protected */
    getEditButton(state) {
        return new ButtonBuilder()
            .setLabel('Edit').setCustomId(`${this.getCustomId(state)}//EDIT`).setStyle(ButtonStyle.Primary).setEmoji('🖊️');
    }

    /** 
     * @protected
     * @override 
     */
    getButtons(state, response) {
        return [
            this.getNextButton(state, response.nextOption), 
            this.getEditButton(state),
            this.getBackButton(state, response.backOption), 
            this.getCancelButton(state, response.cancelOption)
        ].filter(v => v);
    }

    /** 
     * @protected
     * @param {State} state 
     */
    getModal(state) {
        const components = state.getModalComponents()
        if (components.length === 0) return null;
        return new ModalBuilder()
            .setTitle(this.title)
            .setCustomId(`${this.getCustomId(state)}//MODAL`)
            .addComponents(components)
    }

    /** 
     * @private
     * @param {RecallExchangeInteraction} interaction 
     */
    async __getModalResponse(interaction) {
        const action = interaction.args.shift()
        if (interaction.state.index < 0) 
            return new MessageOptionsBuilder().setContent(`*${this.title} Process Cancelled*`).setEphemeral(true)
        if (interaction.type === InteractionType.ModalSubmit && action !== "EDIT") {
            const embed = new EmbedBuilder()
                .setFooter({ text: `${this.title}  •  ${interaction.state.index+1}/${this.length}` })
                .setFields(interaction.state.getEmbedFields(true))
            return this.getModalResponseCall(embed, interaction);  
        }
        const modal = this.getModal(interaction.state);
        if (!modal && !interaction.state.disableNext()) {
            await interaction.update(new MessageOptionsBuilder().setContent('Submitting...'))
            const response = await this.onFinish(interaction)
            const last = !this.getModal(interaction.state) && !interaction.state.disableNext()
            return response ? { ...response, last } : response;
        }
        return modal;
    }

}

module.exports = ExchangeHandler