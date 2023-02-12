const TableRow = require("../postgresql/row");
const TextUtil = require("../tools/text_util");

class NamedRow extends TableRow {

    constructor(client, rowData) {

        super(client, rowData);

        /** @type {string} */
        this.name

    }

    /**
     * @param {string} name 
     */
    setName(name) {
        this.name = name
        return this;
    }

    get titleName() {
        return TextUtil.snakeToUpperCamelCase(this.name);
    }

    /** @type {string} */
    get neatName() {
        return this.name.replaceAll("_", " ");
    }

    get capitalizedName() {
        return this.name[0].toUpperCase() + this.name.slice(1);
    }

}

module.exports = NamedRow