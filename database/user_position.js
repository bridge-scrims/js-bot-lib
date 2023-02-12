const { User } = require("discord.js");
const TableRow = require("../postgresql/row");
const Position = require("./position");

class UserPosition extends TableRow {

    static sortByLevel(a, b) {
        const getPosition = (e) => (e.position ?? { id_position: e.id_position });
        return Position.sortByLevel(getPosition(a), getPosition(b));
    }

    static removeExpired(v) {
        return !(v.isExpired());
    }

    constructor(client, userPositionData) {

        super(client, userPositionData)

        /** @type {string} */
        this.user_id
        
        /** @type {number} */
        this.id_position

        /** @type {string} */
        this.executor_id

        /** @type {number} */
        this.given_at
        
        /** @type {?number} */
        this.expires_at

    }

    get user() {
        if (!this.bot || !this.user_id) return null;
        return this.bot.users.resolve(this.user_id);
    }

    get userProfile() {
        return this.client.users.cache.find(this.user_id);
    }

    /** 
     * @param {string|import('./user_profile')|import('discord.js').User} user 
     */
    setUser(user) {
        this.user_id = user?.user_id ?? user?.id ?? user
        return this;
    }

    get position() {
        return this.client.positions.cache.find(this.id_position);
    }

    /** @param {string|number|Object.<string, any>|Position} positionResolvable */
    setPosition(positionResolvable) {
        if (typeof positionResolvable === "string") positionResolvable = { name: positionResolvable }
        this._setForeignObjectKeys(this.client.positions, ['id_position'], ['id_position'], positionResolvable)
        return this;
    }

    get executor() {
        if (!this.bot || !this.executor_id) return null;
        return this.bot.users.resolve(this.executor_id);
    }

    get executorProfile() {
        return this.client.users.cache.find(this.executor_id);
    }

    /** @param {string|import('./user_profile')|User} executor */
    setExecutor(executor) {
        this.executor_id = executor?.user_id ?? executor?.id ?? executor
        return this;
    }

    /**
     * @param {number} [given_at] if falsely will use current time 
     */
    setGivenPoint(given_at) {
        this.given_at = given_at ?? Math.floor(Date.now()/1000)
        return this;
    }

    /**
     * @param {?number} [expires_at] if falsely will use null (no expiration)
     */
    setExpirationPoint(expires_at = null) {
        this.expires_at = expires_at
        return this;
    }

    /** 
     * @override
     * @param {Object.<string, any>} userPositionData 
     */
    update(userPositionData) {
        super.update(userPositionData);
        this.setPosition(userPositionData.position)
        return this;
    }

    isCacheExpired(now) {
        return this.isExpired() || super.isCacheExpired(now);
    }

    isExpired() {
        return (this.expires_at !== null && this.expires_at <= (Date.now()/1000));
    }

    getDuration() {
        return (this.expires_at === null) ? `*permanently*` 
            : ((!this.expires_at) ? '' : `until <t:${this.expires_at}:f>`);
    }

    getExpiration() {
        return (this.expires_at === null) ? `*permanent*` 
            : ((!this.expires_at) ? '' : `<t:${this.expires_at}:f>`);
    }

    getExpirationDetail() {
        return (this.expires_at === null) ? `[permanent]` 
            : ((!this.expires_at) ? '[unknown-duration]' : `[expires <t:${this.expires_at}:R>]`);
    }

    asUserInfo(guild_id) {
        if (!this.position) return null;
        const expiration = (this.expires_at ? ` (expires <t:${this.expires_at}:R>)` : "")
        return this.position.asUserInfo(guild_id, ':small_blue_diamond:') + expiration;
    }

}

module.exports = UserPosition;