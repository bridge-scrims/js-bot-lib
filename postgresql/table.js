const SQLStatementCreator = require("./statements");
const { SQLTableQueryBuilder } = require("./query");
const DBCache = require("./cache")
const TableRow = require("./row");

/** @template [T=import("./row")] */
class DBTable {

    constructor(client, name, cacheOptions, RowClass) {

        Object.defineProperty(this, 'client', { value: client });

        /**
         * @readonly
         * @type {import('./database')}
         */
        this.client
        
        /** @type {string} */
        this.name = name

        this.queryBuilder = new SQLTableQueryBuilder(this)

        /** @type {DBCache<T>} */
        this.cache = new DBCache(cacheOptions)

        /** 
         * @protected
         * @type {T.constructor} 
         */
        this.RowClass = RowClass
        this.RowClass.table = this.name

        /** @protected */
        this.listening = false

    }

    get ipc() { 
        return this.client.ipc;
    }

    get foreigners() {
        return this.client.foreigners[this.name] ?? {};
    }

    get uniqueKeys() {
        return this.client.uniqueKeys[this.name] ?? [];
    }

    get columns() {
        return this.client.columns[this.name] ?? [];
    }
    
    get exists() {
        return this.columns.length > 0;
    }

    toString() {
        return this.name;
    }
    
    async query(...query) {
        return this.client.query(...query).then(v => this._getRows(v.rows));
    }

    async connect() {
        this._addListeners()
        await this.initializeCache()
    }

    /** @protected */
    _addListeners() {
        if (!this.listening) {
            this.ipc.on(`${this.name}_remove`, message => this.cache.filterOut(message.payload))
            this.ipc.on(`${this.name}_update`, message => this.cache.update(message.payload.selector, message.payload.data))
            this.ipc.on(`${this.name}_create`, message => this.cache.push(this._getRow(message.payload)))
            this.listening = true
        }
    }

    async initializeCache() {
        await this.sqlFetch()
    }

    /**
     * @param {string} functionName 
     * @param {Object.<string, any>|Array.<string>} [parameters] 
     */
    async call(functionName, parameters) {
        functionName = `${this}_${functionName}`
        const query = this.queryBuilder.buildFunctionCall(functionName, parameters)
        const result = await this.client.query(...query)
        const rows = this._getRows([result.rows?.[0]?.[functionName] ?? []].flat())
        rows.forEach(row => this.cache.push(row))
        return rows;
    }

    /** 
     * @protected
     * @param {Object.<string, any>[]} rowDatas 
     */
    _getRows(rowDatas) {
        return rowDatas.map(rowData => this._getRow(rowData));
    }

    /**
     * @protected
     * @param {Object.<string, any>} rowData
     * @returns {T}
     */
    _getRow(rowData) {
        if (rowData instanceof this.RowClass) return rowData;
        return new this.RowClass(this.client, rowData);
    }

    /**
     * @param {SQLStatementCreator|Object.<string, any>|T} [selector] If falsely, fetches all.
     * @param {string[]} mapKeys
     * @returns {Promise<{ [x: string]: T }>}
     */
    async fetchMap(selector, mapKeys) {
        const result = await this.sqlFetch(selector)
        return Object.fromEntries(result.map(value => [mapKeys.reduce((v, key) => v?.[key], value), value]));
    }

    /**
     * @param {SQLStatementCreator|Object.<string, any>|T} [selector] If falsely, fetches all.
     * @param {string[]} mapKeys
     * @returns {Promise<{ [x: string]: T[] }>}
     */
    async fetchArrayMap(selector, mapKeys) {
        const obj = {}
        const result = await this.sqlFetch(selector)
        result.map(value => [mapKeys.reduce((v, key) => v?.[key], value), value])
            .forEach(([key, value]) => (key in obj) ? obj[key].push(value) : obj[key] = [value])
        return obj;
    }

    /** 
     * @param {Object.<string, any>|T|string|number|Array.<string>} selector
     * @param {Object.<string, any>} data
     * @returns {Promise<T[]>}
     */
    async update(selector, data) {
        const row = (selector instanceof TableRow) ? selector : null
        if (selector instanceof TableRow) selector = selector.toSelector()
        if (selector instanceof Array || typeof selector !== "object") selector = this._getSelectorFromId(selector)

        const existing = row?.toJSON() ?? (this.cache.find(selector)?.toJSON() ?? null) 
        this.cache.update(selector, data)
        if (row) row.update(data)

        const result = await this.sqlUpdate(selector, data).catch(error => error)
        if (result instanceof Error) {
            // Update failed so we need to make sure that the cache also reverts the update
            if (existing) {
                // If we know how it looked before the update we just put it back
                this.cache.update(selector, existing)
                if (row) row.update(existing)
            }else {
                // Since we don't know the original state we just remove it from the cache since it is now wrong
                this.cache.remove(selector)
            }
            throw result;
        }
        return result;
    }

    /** 
     * @deprecated Use delete instead!
     * @param {Object.<string, any>|T|string|number|Array.<string>} [selector] If falsely, deletes all.
     */
    async remove(selector) {
        return this.delete(selector);
    }

    /** 
     * @param {Object.<string, any>|T|string|number|Array.<string>} [selector] If falsely, deletes all.
     * @returns {Promise<T[]>}
     */
    async delete(selector) {
        if (selector && selector instanceof Array || typeof selector !== "object") selector = this._getSelectorFromId(selector)
        const cacheRemoved = this.cache.filterOut(selector)
        const result = await this.sqlDelete(selector).catch(error => error)
        if (result instanceof Error) {
            // Delete failed so we can add back the rows to cache
            cacheRemoved.forEach(r => this.cache.push(r))
            throw result;
        }
        return result;
    }

    /** 
     * @param {Object.<string, any>|T|string|number|Array.<string>} selector
     */
    async del(selector) {
        return this.delete(selector).then(v => v[0] || null);
    }

    /**
     * @param {Object.<string, any>|T} [options] If falsely, fetches all.
     * @param {boolean} [useCache]
     */
    async fetch(options, useCache=true) {
        if (useCache) {
            const cached = this.cache.get(options)
            if (cached?.length > 0) return cached;
        }
        return this.sqlFetch(options);
    }

    /**
     * @param {Object.<string, any>|Array.<string>|string|number|T} options
     * @param {boolean} [useCache]
     */
    async find(options, useCache=true) {
        if (useCache) {
            const cached = this.cache.find(options)
            if (cached) return cached;
        }
        if (options instanceof Array || typeof options !== "object") options = this._getSelectorFromId(options)
        return this.sqlFind(options);
    }

    /**
     * @typedef {import("./query").SQLOptions} SQLSelectOptions
     */

    /**
     * @typedef SQLFindOptions
     * @property {boolean} [forceSingle] If null should be returned if more then one column gets selected.
     */

    /** 
     * @param {SQLStatementCreator|Object.<string, any>|T} selector
     * @param {Omit<SQLSelectOptions, "limit"> & SQLFindOptions} [options]
     * @returns {Promise<T | null>}
     */
    async sqlFind(selector, options = {}) {
        if (!this.exists) return null;
        options.limit = (options.forceSingle ? 2 : 1)
        const query = this.queryBuilder.buildSelectQuery(this._getStatement(selector), options)
        const rows = await this.query(...query)
        rows.forEach(row => this.cache.push(row))
        if (rows.length !== 1) return null;
        return rows[0] ?? null;
    }

    /** 
     * @param {SQLStatementCreator|Object.<string, any>|T} selector
     * @param {Omit<SQLSelectOptions, "limit"> & Omit<SQLFindOptions, forceSingle>} [options]
     */
    async sqlFindUnique(selector, options = {}) {
        return this.sqlFind(selector, { ...options, forceSingle: true })
    }

    /** 
     * @param {SQLStatementCreator|Object.<string, any>|T} [selector] If falsely, fetches all.
     * @param {SQLSelectOptions} [options]
     */
    async sqlFetch(selector, options = {}) {
        if (!this.exists) return [];
        const query = this.queryBuilder.buildSelectQuery(this._getStatement(selector), options)
        const rows = await this.query(...query)
        if (!selector) this.cache.setAll(rows)
        else rows.forEach(row => this.cache.push(row))
        return rows;
    }

    /** 
     * @param {SQLStatementCreator|Object.<string, any>|T} selector
     * @param {Object.<string, any>} data
     */
    async sqlUpdate(selector, data) {
        if (!this.exists) return [];
        const query = this.queryBuilder.buildUpdateQuery(data, this._getStatement(selector))
        const rows = await this.query(...query)
        rows.filter(row => row.id).forEach(row => this.cache.push(row))
        return rows;
    }

    /** 
     * @param {SQLStatementCreator|Object.<string, any>|T} [selector] If falsely, deletes all. 
     */
    async sqlDelete(selector) {
        if (!this.exists) return [];
        const query = this.queryBuilder.buildDeleteQuery(this._getStatement(selector))
        const rows = await this.query(...query)
        rows.filter(row => row.id).forEach(row => this.cache.remove(row.id))
        return rows;
    }

    /** 
     * @param {SQLStatementCreator|Object.<string, any>|T} [selector] If falsely, fetches all. 
     */
    async count(selector) {
        if (!this.exists) return 0;
        const query = this.queryBuilder.buildCountQuery(this._getStatement(selector))
        const result = await this.client.query(...query)
        return parseInt(result.rows?.[0]?.["count"] ?? 0);
    }

    /** 
     * @protected
     * @param {SQLStatementCreator|Object.<string, any>|T} [selector]
     * @returns {SQLStatementCreator}
     */
    _getStatement(selector) {
        if (selector instanceof TableRow) selector = selector.toSelector()
        if (!(selector instanceof SQLStatementCreator)) selector = new SQLStatementCreator(selector)
        return selector;
    }

    /** @protected */
    _getSelectorFromId(id) {
        if (!(id instanceof Array)) id = [id] 
        return Object.fromEntries(this.uniqueKeys.map((key, idx) => [key, id[idx]]));
    }

    /** 
     * @param {T|Object.<string, any>|(builder: T) => T} obj 
     * @returns {Promise<T>}
     */
    async create(obj) {
        if (!this.exists) return null;
        if (typeof obj === 'function') obj = obj(new this.RowClass(this.client))
        if (obj.id) this.cache.push(obj)
        const query = this.queryBuilder.buildInsertQuery((obj instanceof TableRow) ? obj.toSQLData() : obj)
        const result = await this.query(...query).catch(error => error)
        if (result instanceof Error) {
            if (obj.id) this.cache.remove(obj.id)
            throw result;
        }
        const row = result[0]
        if (obj.id) {
            obj.update(row)
            return obj;
        }
        if (row.id) this.cache.push(row)
        return row;
    }

}

module.exports = DBTable;