const { EmbedBuilder, MessagePayload } = require("discord.js");

class UserError extends Error {

    constructor(...args) {

        super();

        /** @type {MessagePayload} */
        this.payload = (args.length === 1) ? this.resolvePayload(args[0]) : this.buildPayload(...args);
        
    }

    /**
     * @param {string} title 
     * @param {string} description 
     */
    buildPayload(title, description) {

        const embed = new EmbedBuilder()
            .setColor("#DC0023").setTitle(title).setDescription(description)

        return { ephemeral: true, components: [], content: null, embeds: [embed] };

    }

    /** @param {MessagePayload|EmbedBuilder} resolvable */
    resolvePayload(resolvable) {

        if (resolvable instanceof EmbedBuilder) {
            if (!resolvable.color) resolvable.setColor("#DC0023")
            return { ephemeral: true, components: [], content: null, embeds: [resolvable] };
        }

        if (typeof resolvable === "string") return this.buildPayload(null, resolvable);

        return resolvable;

    }

    toMessage() {

        return this.payload;

    }

}

module.exports = UserError;