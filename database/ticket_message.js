const { User } = require("discord.js");
const TableRow = require("../postgresql/row");
const Ticket = require("./ticket");

class TicketMessage extends TableRow {

    constructor(client, messageData) {

        super(client, messageData)

        /** @type {number} */
        this.id_ticket

        /** @type {string} */
        this.author_id

        /** @type {string} */
        this.message_id

        /** @type {?string} */
        this.reference_id

        /** @type {string} */
        this.content

        /** @type {?number} */
        this.deleted
        
        /** @type {number} */
        this.created_at

    }

    get guild() {
        return this.ticket?.guild || null;
    }

    get guild_id() {
        return this.ticket?.guild_id || null;
    }

    get channel() {
        return this.ticket?.channel || null;
    }

    get message() {
        if (!this.channel || !this.message_id) return null;
        return this.channel.messages.resolve(this.message_id);
    }

    isCacheExpired(now) {
        return (!this.ticket || this.ticket.status?.name === "deleted") && (!now || super.isCacheExpired(now));
    }

    /**
     * @param {string|Object.<string, any>|Ticket} ticketResolvable 
     */
    setTicket(ticketResolvable) {
        this._setForeignObjectKeys(this.client.tickets, ['id_ticket'], ['id_ticket'], ticketResolvable)
        return this;
    }

    get ticket() {
        return this.client.tickets.cache.find(this.id_ticket);
    }

    /** @param {string|import('./user_profile')|User} author */
    setAuthor(author) {
        this.author_id = author?.user_id ?? author?.id ?? author
        return this;
    }

    get author() {
        if (!this.bot || !this.author_id) return null;
        return this.bot.users.resolve(this.author_id);
    }
    
    get authorProfile() {
        return this.client.users.cache.find(this.author_id);
    }

    /** @param {import("discord.js").MessageResolvable} messageResolvable */
    setMessage(messageResolvable) {
        this.message_id = messageResolvable?.id ?? messageResolvable
        return this;
    }

    /** @param {string} reference_id */
    setReferenceId(reference_id) {
        this.reference_id = reference_id
        return this;
    }

    /** @param {string} content */
    setContent(content) {
        this.content = content
        return this;
    }

    /** @param {number} [deleted] If undefined will use current timestamp */
    setDeletedPoint(deleted) {
        this.deleted = deleted ?? Math.floor(Date.now()/1000)
        return this;
    }

    /**
     * @param {number} [created_at] If undefined will use current timestamp 
     */
    setCreatedPoint(created_at) {
        this.created_at = created_at ?? Math.floor(Date.now()/1000)
        return this;
    }

    /** 
     * @override
     * @param {Object.<string, any>} messageData 
     */
    update(messageData) {
        super.update(messageData)
        this.setTicket(messageData.ticket)
        return this;
    }

}

module.exports = TicketMessage;