class TableRow {

    /** @type {string} */
    static table = null

    /** 
     * @param {import('./database')} client 
     * @param {Object.<string, any>} [data] 
     */
    constructor(client, data={}) {

        Object.defineProperty(this, 'client', { value: client });

        /**
         * @type {import('./database')}
         * @readonly
         */
        this.client

        if (data) this.update(data)

    }

    get bot() {
        return this.client.bot;
    }

    get id() {
        if (this.uniqueKeys.length > 0 && this.uniqueKeys.every(key => (key in this))) return this.uniqueKeys.map(key => this[key]).join('#');
        if (this.columns.length > 0 && this.columns.every(key => (key in this))) return this.columns.map(key => this[key]).join('#');
        return null;
    }

    /** @returns {Array.<string>} */
    get uniqueKeys() {
        return this.client.uniqueKeys[this.constructor.table] ?? [];
    }

    /** @returns {Array.<string>} */
    get columns() {
        return this.client.columns[this.constructor.table] ?? [];
    }

    get partial() {
        return this.columns.some(key => this[key] === undefined);
    }

    isCacheExpired(now) {
        return ((this._expiration !== undefined) && (this._expiration <= now));
    }

    setCacheExpiration(expiration) {
        this._expiration = expiration
    }

    /**
     * @deprecated
     * @param {import('./table')} table 
     * @param {string} objKey 
     * @param {string[]} localIdKeys 
     * @param {string[]} foreignIdKeys 
     * @param {string|number|Object.<string, any>|TableRow|undefined} resolvable 
     */
    _setForeignObjectReference(table, objKey, localIdKeys, foreignIdKeys, resolvable) {
        
        if (resolvable === null) {
            this[objKey] = null
        }else {

            if (resolvable && foreignIdKeys.every(key => resolvable[key] !== undefined))
                this[objKey] = table.cache.find(foreignIdKeys.map(key => resolvable[key]))
            else if (!resolvable && localIdKeys.every(key => this[key] !== undefined))
                this[objKey] = table.cache.find(localIdKeys.map(key => this[key]))
            else if (resolvable)
                this[objKey] = table.cache.find(resolvable)

            // resolvable was not found in cache but maybe it is a full object
            if (resolvable && !this[objKey] && (typeof resolvable === "object")) {

                const obj = table.getRow(resolvable)
                if (!obj.partial) this[objKey] = obj

            }
            
        }

        if (this[objKey]) localIdKeys.forEach((key, idx) => this[key] = this[objKey][foreignIdKeys[idx]] ?? null)
        if (resolvable && !this[objKey]) localIdKeys.forEach(key => this[key] = null)

    }

    /**
     * @param {import('./table')} table 
     * @param {string[]} localIdKeys 
     * @param {string[]} foreignIdKeys 
     * @param {string|number|Object.<string, any>|TableRow|null|undefined} resolvable 
     */
    _setForeignObjectKeys(table, localIdKeys, foreignIdKeys, resolvable) {
        if (resolvable === undefined) return false;
        if (!this._extractPrimaryKeys(resolvable, localIdKeys, foreignIdKeys))
            if (!resolvable || !this._extractPrimaryKeys(table.cache.find(resolvable), localIdKeys, foreignIdKeys))
                localIdKeys.forEach(key => this[key] = null)
    }

    /**
     * @deprecated
     * @param {import('./table')} table
     * @param {string[]} localIdKeys 
     * @param {string[]} foreignIdKeys 
     * @param {string|number|Object.<string, any>|TableRow|null|undefined} resolvable 
     */
    _setForeignWeakReference(table, refKey, localIdKeys, foreignIdKeys, resolvable) {
        /**
         * - **TableRow:** Foreigner instance built from `resolvable` or from cache.
         * - **undefined:** Foreigner is not in cache and can't be built.
         * - **null:** Foreigner is null.
         */
        const obj = (() => {

            if (resolvable === null) return null;
            if (typeof resolvable === "object") {  
                if (foreignIdKeys.every(key => resolvable[key] !== undefined))
                    return table.cache.find(foreignIdKeys.map(key => resolvable[key])) || table.getRow(resolvable);

                localIdKeys.forEach((key, idx) => {
                    const value = resolvable[foreignIdKeys[idx]]
                    if (value !== undefined && value !== this[key]) this[key] = value;
                })
                return undefined;
            }

            if (resolvable === undefined && localIdKeys.every(key => this[key] !== undefined))
                return table.cache.find(localIdKeys.map(key => this[key])) || undefined;

            if (resolvable !== undefined) return table.cache.find(resolvable) || undefined;

        })()

        if (typeof obj === "object") {
            localIdKeys.forEach((key, idx) => this[key] = obj?.[foreignIdKeys[idx]] ?? null)
        }

        if (obj instanceof TableRow && this[refKey]?.deref() === obj) return;

        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakRef
        // eslint-disable-next-line no-undef
        Object.defineProperty(this, refKey, { value: ((obj instanceof TableRow) ? new WeakRef(obj) : null), configurable: true })
    }

    /**
     * @param {Object.<string, any>} target 
     * @param {string[]} localIdKeys 
     * @param {string[]} foreignIdKeys 
     */
    _extractPrimaryKeys(target, localIdKeys, foreignIdKeys) {
        if (foreignIdKeys.every(key => target?.[key] !== undefined)) {
            localIdKeys.forEach((key, idx) => this[key] = target[foreignIdKeys[idx]] ?? null)
            return true;
        }
    }

    /** @param {Object.<string, any>} data */
    update(data) {
        Object.entries(data).forEach(([key, value]) => {
            if (this.columns.includes(key)) this[key] = value
        })
        return this;
    }

    /**
     * @param {Object.<string, any>} obj1 
     * @param {Object.<string, any>} obj2 
     * @returns {boolean}
     */
    valuesMatch(obj1, obj2) {
        if (!obj1 || !obj2) return false;
        if (obj1 === obj2) return true;
        return Object.entries(obj1).every(([key, value]) => 
            (value instanceof Object && obj2[key] instanceof Object) 
                ? this.valuesMatch(value, obj2[key]) : (obj2[key] == value)
        );
    }

    /**
     * @param {Object.<string, any>|TableRow} obj 
     * @returns {boolean}
     */
    equals(obj) {
        if (this.uniqueKeys.length > 0 && this.uniqueKeys.every(key => obj[key] !== undefined && this[key] !== undefined))
            return this.uniqueKeys.every(key => this[key] === obj[key]);
        return this.exactlyEquals(obj);
    }

    toSelector() {
        const data = this.toSQLData()
        if (this.uniqueKeys.length > 0 && this.uniqueKeys.every(key => this[key] !== undefined))
            return Object.fromEntries(this.uniqueKeys.map(key => [key, data[key]]))
        return data;
    }

    /**
     * @param {Object.<string, any>|TableRow} obj 
     * @returns {boolean}
     */
    exactlyEquals(obj) {
        return this.valuesMatch(Object.fromEntries(Object.entries(obj).filter(([key, _]) => (!key.startsWith('_')))), this);
    }

    toJSON() {
        return this.toSQLData()
    }

    toSQLData() {
        return Object.fromEntries(Object.entries(this).filter(([key, _]) => this.columns.includes(key)));
    }

    /** @returns {this} */
    clone() {
        return new this.constructor(this.client, this);
    }

    destroy() {
        // Cleanup can be done here (e.g. removing listeners)
    }

}

module.exports = TableRow;