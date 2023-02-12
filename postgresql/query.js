const SQLStatementCreator = require("./statements")
const TextUtil = require("../tools/text_util")

const THIS = '"_this"'

/**
 * @typedef SQLOptions
 * @property {string} [order_by]
 * @property {number} [limit]
 */

class SQLQueryBuilder {

    /** 
     * @protected
     * @param {Object.<string, any>|Array.<string>} [parameters] 
     */
    _createFunctionParameters(parameters, values=[]) {
        if (!parameters) return ["", values];
        if (parameters instanceof Array) {
            parameters = Object.fromEntries(parameters.map((v, i) => [i, v]))
            return [new SQLStatementCreator(parameters).toFuncArgs(values), values]
        }
        return [new SQLStatementCreator(parameters).toFuncParams(values), values]
    }

    /**
     * @param {string} functionName 
     * @param {Object.<string, any>|Array.<string>} [parameters] 
     */
    buildFunctionCall(functionName, parameters) {
        const [formattedParameters, values] = this._createFunctionParameters(parameters)
        return [`SELECT ${functionName}(${formattedParameters})`, values]
    }

}

class SQLTableQueryBuilder extends SQLQueryBuilder {
 
    constructor(table) {
        
        super()
        Object.defineProperty(this, "table", { value: table })

        /** 
         * @readonly
         * @type {import('./table')} 
         */
        this.table

    }

    get foreigners() {
        return this.table.foreigners;
    }

    /** @protected */
    _readForeignerShaper() {
        /**
         * @param {Object.<string, any>} obj
         * @param {Array.<string>} params
         */
        return (obj, params) => {
            for (const [localKey, [column, foreignTable, foreignColumn]] of Object.entries(this.foreigners)) {
                if (localKey in obj) {
                    const subQuery = `(SELECT %s FROM ${foreignTable} _v WHERE ${THIS}."${column}"=_v."${foreignColumn}")`
                    Object.entries(obj[localKey])
                        .forEach(([key, val]) => obj[TextUtil.format(subQuery, key)] = val)
                    delete obj[localKey]
                }
            }
        }
    }

    /** @protected */
    _writeForeignerShaper() {
        /**
         * @param {Object.<string, any>} obj
         * @param {Array.<string>} params
         */
        return (obj, params) => {
            for (const [localKey, [column, foreignTable, foreignColumn]] of Object.entries(this.foreigners)) {
                if (localKey in obj) {
                    const whereClause = new SQLStatementCreator(obj[localKey], { parent: localKey }).toWhereStatement(params)
                    obj[column] = {
                        $: `(SELECT ${foreignColumn} FROM ${foreignTable} "${localKey}" ${(whereClause ? `WHERE ${whereClause}` : "")} LIMIT 1)`
                    }
                    delete obj[localKey]
                }
            }
        }
    }

    /** @protected */
    _leftJoins() {
        return Object.entries(this.foreigners).map(([localKey, [column, foreignTable, foreignColumn]]) => (
            `LEFT JOIN ${foreignTable} "${localKey}" ON ${THIS}."${column}"="${localKey}"."${foreignColumn}"`
        )).join(" ")
    }

    /** 
     * @protected
     * @param {SQLOptions} 
     */
    _optionsToSQL({ order_by, limit }) {
        return [
            (order_by ? `ORDER BY ${order_by}` : null), 
            ((typeof limit === "number") ? `LIMIT ${limit}` : null)
        ].filter(v => v).join(" ")
    }

    /** 
     * @param {SQLStatementCreator} whereStatement
     * @param {SQLOptions} options
     */
    buildSelectQuery(whereStatement, options = {}) {
        const params = []
        const where = whereStatement.setParent(THIS).toWhereStatement(params)
        return [
            `SELECT ${THIS}.* FROM ${this.table} ${THIS} ${this._leftJoins()} `
                + `${where ? `WHERE ${where}` : ''} ${this._optionsToSQL(options)}`,
            params
        ]
    }

    /** 
     * @param {SQLStatementCreator} whereStatement
     * @param {SQLOptions} options
     */
    buildCountQuery(whereStatement, options = {}) {
        const params = []
        const where = whereStatement.setParent(THIS).toWhereStatement(params)
        return [
            `SELECT count(*) FROM ${this.table} ${THIS} ${this._leftJoins()} `
                + `${where ? `WHERE ${where}` : ''} ${this._optionsToSQL(options)}`,
            params
        ]
    }

    /** 
     * @param {SQLStatementCreator} whereStatement
     * @param {SQLOptions} options
     */
    buildDeleteQuery(whereStatement, options = {}) {
        const params = []
        const where = whereStatement.setParent(THIS).sqlShape(this._readForeignerShaper(), params).toWhereStatement(params)
        return [
            `DELETE FROM ${this.table} ${THIS} ${where ? `WHERE ${where}` : ''} `
                + `${this._optionsToSQL(options)} RETURNING *`,
            params
        ]
    }
    
    /** 
     * @param {Object.<string, any>} data
     * @param {SQLStatementCreator} whereStatement
     * @param {SQLOptions} options
     */
    buildUpdateQuery(data, whereStatement, options = {}) {
        const params = []
        const set = new SQLStatementCreator(data)
            .setParent(THIS).sqlShape(this._writeForeignerShaper(), params).toSetStatement(params)
        const where = whereStatement
            .setParent(THIS).sqlShape(this._readForeignerShaper(), params).toWhereStatement(params)
        if (!set) throw new Error("SQLQueryBuilder: Empty Set Statement", data)
        return [
            `UPDATE ${this.table} ${THIS} SET ${set} ${where ? `WHERE ${where}` : ''} `
                + `${this._optionsToSQL(options)} RETURNING *`,
            params
        ]
    }

    /** 
     * @param {Object.<string, any>} data
     */
    buildInsertQuery(data) {
        const params = []
        const insert = new SQLStatementCreator(data).sqlShape(this._writeForeignerShaper(), params).toInsertStatement(params)
        if (!insert) throw new Error("SQLQueryBuilder: Empty Insert Statement", data)
        return [
            `INSERT INTO ${this.table} ${insert} RETURNING *`,
            params
        ]
    }

}

module.exports = { SQLQueryBuilder, SQLTableQueryBuilder };