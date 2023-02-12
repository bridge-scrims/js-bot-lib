const NamedRow = require("./named_row");

class TicketStatus extends NamedRow {

    constructor(client, statusData) {

        super(client, statusData);

        /** @type {number} */
        this.id_status

    }

}

module.exports = TicketStatus;