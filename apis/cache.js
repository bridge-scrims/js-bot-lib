/**
 * @template T Type that this cache holds.
 */
class APICache {

    constructor(defaultTTL=-1, maxKeys=-1) {

        /** 
         * @protected
         * @type {Object.<string, T>} 
         */
        this.data = {}

        /**
         * @protected
         * @type {Object.<string, number>} 
         */
        this.expirations = {}

        /** 
         * Default time to live of cache entries. 
         * @type {number} 
         * @readonly
         */
        this.defaultTTL
        Object.defineProperty(this, 'defaultTTL', { value: defaultTTL });

        /** 
         * Maximum amount of keys before elements are removed. 
         * @type {number} 
         * @readonly
         */
        this.maxKeys = maxKeys
        Object.defineProperty(this, 'maxKeys', { value: maxKeys });

        this.removeExpiredLoop()

    }

    keys() {
        return Object.keys(this.data);
    }

    values() {
        return Object.values(this.data);
    }

    size() {
        return this.keys().length;
    }

    filter(predicate) {
        return Object.values(this.data).filter(predicate);
    }

    /** @private */
    removeExpiredLoop() {
        this.removeExpired()
        setTimeout(() => this.removeExpiredLoop(), 60*1000)
    }

    /** @protected */
    genExpiration(ttl=0) {
        if (!ttl) ttl = this.defaultTTL;
        if (ttl > 0) return Math.round((Date.now()/1000) + ttl);
        return null;
    }

    get(key) {
        const entry = this.data[key]
        if (!entry) return null;

        const newExpiration = this.genExpiration() 
        const expiration = this.expirations[key]
        if (expiration && newExpiration && (newExpiration > expiration)) 
            this.expirations[key] = newExpiration
        
        return entry;
    }

    removeExpired() {
        const expired = this.keys().filter(key => this.expirations[key] && ((Date.now()/1000) >= this.expirations[key]))
        expired.forEach(key => this.delete(key))
    }

    delete(key) {
        if (key in this.data) delete this.data[key];
        if (key in this.expirations) delete this.expirations[key];
    }

    /** @protected */
    checkSize() {
        if (this.maxKeys === 0) return false;
        if (this.maxKeys < 0) return true;

        this.removeExpired()

        const difference = this.size() - this.maxKeys
        if (difference >= 0)
            this.keys().slice(0, (difference+1)).forEach(key => this.delete(key))
        
        return true;
    }

    /**
     * @param {string} key 
     * @param {T} value 
     * @param {number} [ttl] 
     */
    set(key, value, ttl=0) {
        const isSpace = this.checkSize()
        if (!isSpace) return false;

        this.data[key] = value
        const expiration = this.genExpiration(ttl)
        if (expiration) this.expirations[key] = expiration

        return value;
    }

}

module.exports = APICache;