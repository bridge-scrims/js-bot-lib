const { 
    SlashCommandBuilder, SlashCommandSubcommandBuilder, SlashCommandSubcommandGroupBuilder, 
    SharedNameAndDescription, SlashCommandRoleOption, SlashCommandBooleanOption,
    SlashCommandAttachmentOption, SlashCommandChannelOption, SlashCommandIntegerOption,
    SlashCommandNumberOption, SlashCommandStringOption, SlashCommandUserOption, 
    SlashCommandMentionableOption, ContextMenuCommandBuilder
} = require("discord.js");

const I18n = require("../../tools/internationalization");
const DEFAULT_LOCALE = I18n.getInstance()

const setNameLocalizations = SharedNameAndDescription.prototype.setNameLocalizations
const setDescriptionLocalizations = SharedNameAndDescription.prototype.setDescriptionLocalizations
const setDescription = SharedNameAndDescription.prototype.setDescription
const setName = SharedNameAndDescription.prototype.setName

const contextMenuSetName = ContextMenuCommandBuilder.prototype.setName 
ContextMenuCommandBuilder.prototype.setName = function(resourceId, ...params) {
    if (!DEFAULT_LOCALE.hasString(resourceId)) return contextMenuSetName.apply(this, arguments);
    if (!this.name) contextMenuSetName.apply(this, [DEFAULT_LOCALE.get(resourceId, ...params)])
    this.setNameLocalizations(I18n.getLocalizations(resourceId, ...params))
    return this;
}

const overwritePrototype = (c) => {

    c.prototype.setNameLocalizations = function(resourceId, ...params) {
        setNameLocalizations.apply(this, [I18n.getLocalizations(resourceId, ...params)])
        return this;
    }

    c.prototype.setDescriptionLocalizations = function(resourceId, ...params) {
        setDescriptionLocalizations.apply(this, [I18n.getLocalizations(resourceId, ...params)])
        return this;
    }

    c.prototype.setName = function(resourceId, ...params) {
        if (!DEFAULT_LOCALE.hasString(resourceId)) return setName.apply(this, arguments);
        if (!this.name) setName.apply(this, [DEFAULT_LOCALE.get(resourceId, ...params)])
        setNameLocalizations.apply(this, [I18n.getLocalizations(resourceId, ...params)])
        return this;
    }

    c.prototype.setDescription = function(resourceId, ...params) {
        if (!DEFAULT_LOCALE.hasString(resourceId)) return setDescription.apply(this, arguments);
        if (!this.description) setDescription.apply(this, [DEFAULT_LOCALE.get(resourceId, ...params)])
        setDescriptionLocalizations.apply(this, [I18n.getLocalizations(resourceId, ...params)])
        return this;
    }

    c.prototype.setNameAndDescription = function(resourceId, ...params) {
        this.setName(`${resourceId}.name`, ...params)
        this.setDescription(`${resourceId}.description`, ...params)
        return this;
    }

}

[
    SharedNameAndDescription,
    SlashCommandRoleOption,
    SlashCommandBooleanOption,
    SlashCommandAttachmentOption,
    SlashCommandChannelOption,
    SlashCommandIntegerOption,
    SlashCommandNumberOption,
    SlashCommandStringOption,
    SlashCommandUserOption, 
    SlashCommandMentionableOption
].forEach(overwritePrototype)

class LocalizedSlashCommandBuilder extends SlashCommandBuilder {
    
    /**
     * Sets the name and the name localizations
     * @returns {this}
     */
    setName(resourceId, ...params) {
        return SharedNameAndDescription.prototype.setName.apply(this, arguments);
    }

    /**
     * Sets the description and the description localizations
     * @returns {this}
     */
    setDescription(resourceId, ...params) {
        return SharedNameAndDescription.prototype.setDescription.apply(this, arguments);
    }

    /** @returns {this} */
    setNameAndDescription(resourceId, ...params) {
        return SharedNameAndDescription.prototype.setNameAndDescription.apply(this, arguments);
    }

}

class LocalizedSlashCommandSubcommandBuilder extends SlashCommandSubcommandBuilder {
    
    /**
     * Sets the name and the name localizations
     * @returns {this}
     */
    setName(resourceId, ...params) {
        return SharedNameAndDescription.prototype.setName.apply(this, arguments);
    }

    /**
     * Sets the description and the description localizations
     * @returns {this}
     */
    setDescription(resourceId, ...params) {
        return SharedNameAndDescription.prototype.setDescription.apply(this, arguments);
    }

    /** @returns {this} */
    setNameAndDescription(resourceId, ...params) {
        return SharedNameAndDescription.prototype.setNameAndDescription.apply(this, arguments);
    }

}

class LocalizedSlashCommandSubcommandGroupBuilder extends SlashCommandSubcommandGroupBuilder {
    
    /**
     * Sets the name and the name localizations
     * @returns {this}
     */
    setName(resourceId, ...params) {
        return SharedNameAndDescription.prototype.setName.apply(this, arguments);
    }

    /**
     * Sets the description and the description localizations
     * @returns {this}
     */
    setDescription(resourceId, ...params) {
        return SharedNameAndDescription.prototype.setDescription.apply(this, arguments);
    }

    /** @returns {this} */
    setNameAndDescription(resourceId, ...params) {
        return SharedNameAndDescription.prototype.setNameAndDescription.apply(this, arguments);
    }

}


module.exports = { 
    LocalizedSlashCommandBuilder,
    LocalizedSlashCommandSubcommandBuilder,
    LocalizedSlashCommandSubcommandGroupBuilder
}