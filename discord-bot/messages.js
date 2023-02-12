const MessageOptionsBuilder = require('../tools/payload_builder');
const LocalizedError = require('../tools/localized_error');

const fs = require('fs');
const path = require('path');

const ASSETS = path.join('src', 'assets');

/**
 * @callback MessageBuilder
 * @argument {import('./permissions').PermissibleMember} member
 * @returns {Promise<MessageOptionsBuilder>|MessageOptionsBuilder>}
 */

function load() {
    try {
        return JSON.parse(fs.readFileSync(path.join(ASSETS, "messages.json"), 'utf-8'))
    }catch {
        return {}
    }
}

class BotMessagesContainer {

    constructor() {

        /** @type {Object.<string, MessageBuilder>} */
        this.messageBuilders = {}

        /** @type {Object.<string, {payload: MessageOptions, permissions?: import('./permissions').Permissions}>} */
        this.messages = load()

    }

    /**
     * @param {string} id 
     * @param {MessageBuilder} builder 
     */
    addBuilder(id, builder) {
        this.messageBuilders[id] = builder
    }

    /**
     * @param {import('./permissions').PermissibleMember} member
     */
    async getIdentifiers(member) {
        const idsFromBuilders = await Promise.all(Object.entries(this.messageBuilders).map(([id, builder]) => this.__callBuilder(builder, member, id)))
        const idsFromFile = Object.entries(this.messages).filter(([_, message]) => member.hasPermission(message.permissions ?? {})).map(([k, _]) => k)
        return idsFromFile.concat(idsFromBuilders).filter(v => v);
    }

    /** @private */
    async __callBuilder(builder, member, passthrough) {
        try {
            await builder(member)
        }catch {
            return null;
        }
        return passthrough;
    }

    /**
     * @param {string} id 
     * @param {import('./permissions').PermissibleMember} member
     * @returns {Promise<MessageOptionsBuilder>}
     */
    async get(id, member) {
        if (id in this.messageBuilders) return this.messageBuilders[id](member);
        if (id in this.messages) {
            if (!member.hasPermission(this.messages[id].permissions ?? {})) throw new LocalizedError("missing_message_permissions");
            return this.messages[id].payload;
        }
        return null;
    }

}

module.exports = BotMessagesContainer;