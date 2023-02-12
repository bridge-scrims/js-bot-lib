const { Message, Events } = require("discord.js");
const SequencedAsyncFunction = require("../../tools/sequenced_async");

/**
 * @typedef FloatingMessageConfig
 */

/**
 * @callback getMessageCall
 * @returns {import("discord.js").MessageOptions}
 */

class MessageFloater {

    /**
     * @param {Message} message 
     * @param {getMessageCall} getMessageCall
     * @param {FloatingMessageConfig}
     */
    constructor(message, getMessageCall) {

        this.channel = message.channel
        this.getMessageCall = getMessageCall
        this.send = SequencedAsyncFunction((...a) => this._send(...a), { merge: true })
        
        /** @type {Message | undefined} */
        this.message = message

        this._msgCreateHandler = ((...a) => this.onMessageCreate(...a).catch(console.error))
        this.bot?.on(Events.MessageCreate, this._msgCreateHandler)

        this._channelDeleteHandler = ((...a) => this.onChannelDelete(...a).catch(console.error))
        this.bot?.on(Events.ChannelDelete, this._channelDeleteHandler)

    }

    /** @returns {?import("../bot")} */
    get bot() {
        return this.channel?.client ?? null;
    }

    get channelId() {
        return this.channel?.id;
    }

    /** @param {Message} message */
    async onMessageCreate(message) {
        if (message.channelId === this.channelId)
            if (message.author.id !== message.client.user?.id)
                await this.send()
    }

    async onChannelDelete(channel) {
        if (this.channelId === channel.id) this.channel = null
    }
    
    /** @protected */
    async _send(unstack = true) {

        clearTimeout(this.resendTimeout)

        if (this.channel) {
            await this.message?.delete()?.catch(() => null);
            this.message = await this.channel.send(this.getMessageCall())
    
            // 7 minutes is how long it takes too unstack Discord messages 
            if (unstack) this.resendTimeout = setTimeout(() => this._send(false).catch(console.error), 7*60*1000)
        }

    }

    destroy() {
        this.bot?.off(Events.MessageCreate, this._msgCreateHandler)
        clearTimeout(this.resendTimeout)
        this.message?.delete()?.catch(() => null)
    }

}

module.exports = MessageFloater