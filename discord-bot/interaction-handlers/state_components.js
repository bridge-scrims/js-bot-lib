const { MessageFlags, InteractionType, ButtonBuilder, ActionRowBuilder, ModalBuilder, ButtonStyle } = require("discord.js");
const MessageOptionsBuilder = require("../../tools/payload_builder");
const LocalizedError = require("../../tools/localized_error");

class StateComponentHandler {

    constructor(customId, getResponseCall, verifyCall=null, stateManager=null, parser=null) {

        /** @protected */
        this.states = {}

        /** @protected */
        this.parser = parser

        /** @protected */
        this.stateManager = stateManager

        /** @protected */
        this.verifyCall = verifyCall

        /** @protected */
        this.getResponseCall = getResponseCall

        /** @type {string} */
        this.customId = customId
        
    }

    /** @protected */
    getCustomId(state) {
        return `${this.customId}//${state?.index ?? "0"}/${state ? state.id : "/"}`;
    }

    /** @protected */
    getNextButton(state, label='Continue') {
        if (label === false) return false;
        return new ButtonBuilder()
            .setLabel(label).setCustomId(`${this.getCustomId(state)}/NEXT`).setStyle(ButtonStyle.Success);
    }

    /** @protected */
    getBackButton(state, label='Back') {
        if (label === false) return false;
        return new ButtonBuilder()
            .setLabel(label).setCustomId(`${this.getCustomId(state)}/BACK`).setStyle(ButtonStyle.Secondary).setDisabled(state.index === 0);
    }

    /** @protected */
    getCancelButton(state, label='Cancel') {
        if (label === false) return false;
        return new ButtonBuilder()
            .setLabel(label).setCustomId(`${this.getCustomId(state)}/CANCEL`).setStyle(ButtonStyle.Danger);
    }

    /** @protected */
    getButtons(state, response) {
        return [
            this.getNextButton(state, response.nextOption), 
            this.getBackButton(state, response.backOption), 
            this.getCancelButton(state, response.cancelOption)
        ].filter(v => v);
    }

    /** 
     * @protected
     * @param {RecallComponentInteraction} interaction 
     */
    async getResponse(interaction) {
        const response = await this.getResponseCall(interaction)
        if (response instanceof ModalBuilder) return response;
        if (!response) return null;

        if (!response.last) {
            const buttons = this.getButtons(interaction.state, response)
            if (buttons.length > 0 && interaction.state.index !== -1) 
                response.components = [ new ActionRowBuilder().addComponents(...buttons), ...(response?.components ?? []) ]
            else response.components = response.components ?? []
        }

        return { ...response, ephemeral: true };
    }

    /** 
     * @protected
     * @param {import("discord.js").Interaction & import("./commands").ExpandedInteractionData} interaction 
     */
    async onInteract(interaction) {
        const [_, index, stateId, action] = Array.from(new Array(4)).map(_ => interaction.args.shift())
        
        const state = await this.getState(stateId, interaction)
        if (!state) throw new LocalizedError("recaller_unknown_state")
        state.index = parseInt(index)
    
        if (interaction.type === InteractionType.ModalSubmit && this.parser) {
            if (interaction?.message?.flags?.has(MessageFlags.Ephemeral)) {
                await interaction.update(new MessageOptionsBuilder().setContent('Editing...'))
            }else await interaction.deferReply({ ephemeral: true })
            await this.parser.parseModalComponents(state, interaction, interaction.components.map(v => v.components).flat())
        }

        if (action === 'NEXT') state.index += 1
        if (action === 'BACK') state.index -= 1
        if (action === 'CANCEL') state.index = -1

        this.states[state.id] = state
        interaction.state = state

        const response = await this.getResponse(interaction)
        if (response) await interaction.return(response)
        else if (interaction?.message?.flags?.has(MessageFlags.Ephemeral)) await interaction.return({ content: "Process Complete!", embeds: [], components: [] })
        if (response?.last) delete this.states[state.id];
    }

    /** @protected */
    async getState(stateId, interaction) {
        if (!this.stateManager) return {};
        const state = this.states[stateId] ?? null
        const prevResponse = (interaction?.message?.flags?.has(MessageFlags.Ephemeral)) ? interaction.message : null
        if (!state && prevResponse) return this.stateManager.recall(prevResponse);
        return state ?? this.defaultState;
    }

    get defaultState() {
        return (this.stateManager ? this.stateManager.default() : { });
    }

    /** @param {import("discord.js").Interaction & import("./commands").ExpandedInteractionData} interaction */
    async handle(interaction) {
        interaction.handler = this
        if (interaction?.args?.[0] === "") return this.onInteract(interaction);

        if (this.verifyCall) await this.verifyCall(interaction)
        const state = this.defaultState
        interaction.state = state
        const response = await this.getResponse(interaction)
        if (response) {
            const stateId = state?.id
            if (stateId) {
                this.states[stateId] = state
                setTimeout(() => delete this.states[stateId], 60*60*1000)
            }
            await interaction.return(response)
        }
    }

    /** @returns {import("../commands").Command} */
    asCommand() {
        return {
            command: this.customId,
            handler: (async interaction => this.handle(interaction))
        };
    }

}

/**
 * @typedef RecallComponentState
 * @prop {string} id
 * @prop {number} index
 * 
 * @typedef RecallComponentInteractionData
 * @prop {StateComponentHandler} handler
 * @prop {RecallComponentState} state
 * 
 * @typedef {import("discord.js").Interaction & import("./commands").ExpandedInteractionData & RecallComponentInteractionData} RecallComponentInteraction
 */

module.exports = StateComponentHandler