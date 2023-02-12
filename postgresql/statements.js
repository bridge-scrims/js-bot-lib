const TableRow = require("./row");

class SQLStatementCreator {

    static AND(...objs) {
        return new SQLStatementCreator(objs, { separator: "AND" });
    }

    static NOT(obj) {
        return new SQLStatementCreator(obj, { prefix: "NOT" });
    }

    static AND_NOT(...objs) {
        return new SQLStatementCreator(objs, { prefix: "NOT", separator: "AND" });
    }

    static OR(...objs) {
        return new SQLStatementCreator(objs, { separator: "OR" });
    }

    static OR_NOT(...objs) {
        return new SQLStatementCreator(objs, { prefix: "NOT", separator: "OR" });
    }
    
    static LIKE(...objs) {
        return new SQLStatementCreator(objs, { operator: "LIKE" });
    }
    
    static OR_LIKE(...objs) {
        return new SQLStatementCreator(objs, { operator: "LIKE", separator: "OR" });
    }

    static ILIKE(...objs) {
        return new SQLStatementCreator(objs, { operator: "ILIKE" });
    }

    static OR_ILIKE(...objs) {
        return new SQLStatementCreator(objs, { operator: "ILIKE", separator: "OR" });
    }

    constructor(objs, { prefix, operator, separator, parent } = {}) {
        this.prefix = prefix ?? ""
        this.operator = operator ?? "="
        this.separator = separator ?? "AND"
        this.parent = parent ?? "this"
        /** @type {(Object.<string, any>|SQLStatementCreator)[]} */
        this.objs = [objs].flat(Infinity).map(v => (v instanceof TableRow) ? v.toSQLData() : v)
    }

    setParent(parent) {
        this.parent = parent.replace(/"/g, "")
        this.objs.forEach(obj => obj?.setParent?.(parent))
        return this;
    }

    add(...objs) {
        this.objs.push(...objs.flat())
        return this;
    }

    createWhereStatement(obj, params) {
        this.flatten(obj, params)
        this.sqlParameterize(obj, params)
        return Object.entries(obj).map(([key, value]) => {
            if (value === undefined) return `FALSE`;
            if (value === null) return `${key} IS NULL`;
            return `${key} ${this.operator} ${value}`;
        }).join(" AND ")
    }

    createSetStatement(obj, params) {
        this.sqlParameterize(obj, params)
        return Object.entries(obj)
            .filter(([_, v]) => v !== undefined)
            .map(([k, v]) => `${k} = ${(v === null) ? "NULL" : v}`)
            .join(", ")
    }

    createInsertStatement(obj, params) {
        this.sqlParameterize(obj, params)
        obj = Object.fromEntries(Object.entries(obj).filter(([_, v]) => v !== undefined))
        return `(${Object.keys(obj).join(", ")}) VALUES (${Object.values(obj).map(v => (v === null) ? "NULL" : v).join(", ")})`
    }

    createFuncParams(obj, params) {
        this.sqlParameterize(obj, params)
        return Object.entries(obj)
            .filter(([_, v]) => v !== undefined)
            .map(([k, v]) => `${k} => ${(v === null) ? "NULL" : v}`)
            .join(", ")
    }

    createFuncArguments(obj, params) {
        this.sqlParameterize(obj, params)
        return Object.values(obj)
            .filter(v => v !== undefined)
            .map(v => `${(v === null) ? "NULL" : v}`)
            .join(", ")
    }

    /** @param {Object.<string, any>} obj */
    flatten(obj, params, prevParent) {
        Object.entries(obj)
            .filter(([key, _]) => !(new RegExp("^\\(.*\\)$").test(key)))
            .forEach(([key, val]) => {
                delete obj[key]
                key = `"${key}"`
                if (prevParent) key = `${prevParent}.${key}`
                if (typeof val === "object" && val !== null && !val.$) {
                    val = { ...val }
                    this.flatten(val, params, key)
                    Object.entries(val).forEach(([key, val]) => obj[key] = val)
                }else {
                    if (this.parent && !prevParent) key = `"${this.parent}".${key}`
                    obj[key] = val
                }
            })
    }

    /** @param {Object.<string, any>} obj */
    sqlParameterize(obj, params) {
        Object.entries(obj).forEach(([key, val]) => {
            if (val?.$) obj[key] = val.$
            else if (val !== null && val !== undefined) {
                obj[key] = `$${params.length + 1}`
                params.push(val)
            }
        })
        return obj;
    }

    /** @returns {Object.<string, any>} */
    merge() {
        return this.objs.reduce((pv, cv) => ({ ...pv, ...(cv instanceof SQLStatementCreator ? cv.merge() : cv) }), {}) 
    }

    sqlShape(shaper, params) {
        this.objs.forEach(obj => ((obj instanceof SQLStatementCreator) ? obj.sqlShape(shaper, params) : shaper.bind(this)(obj, params)))
        return this;
    }

    /** @returns {string} */
    toWhereStatement(params) {
        return this.objs.reduce((sql, obj) => {
            const newSQL = ((obj instanceof SQLStatementCreator) ? obj.toWhereStatement(params) : this.createWhereStatement({ ...obj }, params))
            if (!newSQL) return sql;
            if (!sql) return `${this.prefix} ${newSQL}`.trim();
            return `(${sql}) ${this.separator} ${this.prefix}(${newSQL})`;
        }, "")
    }

    /** @returns {string} */
    toSetStatement(params) {
        const obj = this.merge()
        if (Object.keys(obj).length === 0) return "";
        return this.createSetStatement(obj, params)
    }

    /** @returns {string} */
    toInsertStatement(params) {
        const obj = this.merge()
        if (Object.keys(obj).length === 0) return "";
        return this.createInsertStatement(obj, params)
    }

    /** @returns {string} */
    toFuncParams(params) {
        const obj = this.merge()
        if (Object.keys(obj).length === 0) return "";
        return this.createFuncParams(obj, params)
    }

    /** @returns {string} */
    toFuncArgs(params) {
        const obj = this.merge()
        if (Object.keys(obj).length === 0) return "";
        return this.createFuncArguments(obj, params)
    }

}

module.exports = SQLStatementCreator;