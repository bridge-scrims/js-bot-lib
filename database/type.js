const NamedRow = require("./named_row");

class DBType extends NamedRow {

    constructor(client, typeData) {

        super(client, typeData);

        /** @type {number} */
        this.id_type

    }

}

module.exports = DBType;