const I18n = require("./internationalization");

const PAYLOAD = { content: null, embeds: [], components: [], allowedMentions: { parse: [] }, ephemeral: true }
const ERROR_COLOR = "#DC0023"

class LocalizedError extends Error {

    constructor(resourceId, ...params) {
        super(resourceId)
        this.resourceId = resourceId
        this.params = params
    }

    /** @param {I18n} i18n */
    toMessagePayload(i18n) {
        const embed = i18n.getEmbed(this.resourceId, ...this.params).setColor(ERROR_COLOR)
        return { ...PAYLOAD, embeds: [embed] };
    }

}

module.exports = LocalizedError;