const { Events, User, Message } = require("discord.js");
const EventEmitter = require("events");

class PartialsHandledEvents extends EventEmitter {

    constructor(bot) {

        super();

        Object.defineProperty(this, "bot", { value: bot })
        
        /** 
         * @readonly
         * @type {import("./bot")}
         */
        this.bot

        this.__addListeners()
        
    }

    __addListeners() {
        this.bot.on(Events.MessageReactionAdd, (...a) => this.onReaction(...a, Events.MessageReactionAdd).catch(console.error))
        this.bot.on(Events.MessageReactionRemove, (...a) => this.onReaction(...a, Events.MessageReactionRemove).catch(console.error))
    }

    async resolvePartial(obj) {
        if (obj.partial) await obj.fetch();
    }

    /**
     * @typedef MessageReactionData
     * @property {Message} message
     * @property {User} user
     */

    /**
     * @param {import("discord.js").PartialMessageReaction} reaction 
     * @param {import("discord.js").PartialUser} user
     */
    async onReaction(reaction, user, event) {
        await this.resolvePartial(reaction)
        await this.resolvePartial(user)
        reaction.user = user
        this.emit(event, reaction)
    }

}

/**
 * @typedef {import("discord.js").PartialMessageReaction & MessageReactionData} MessageReaction
 */

module.exports = PartialsHandledEvents;