const UserPositionVouchCollection = require("./collections/user_vouches");
const I18n = require("../tools/internationalization");
const DBTable = require("../postgresql/table");
const TableRow = require("../postgresql/row");
const UserProfile = require("./user_profile");
const Position = require("./position");
const { Role } = require("discord.js");

/** @extends {DBTable<ScrimsVouch>} */
class VouchesTable extends DBTable {

    constructor(client) {
        super(client, 'vouch', {}, ScrimsVouch)
    }

    async fetchUserVouches(userId, positionResolvable) {
        return new UserPositionVouchCollection(this.client, userId, positionResolvable).fetch()
    }

    getUserVouches(userId, positionResolvable) {
        return new UserPositionVouchCollection(this.client, userId, positionResolvable).read()
    }

}

class ScrimsVouch extends TableRow {

    static nonExpired(v) {
        return !v.isExpired();
    }

    /** @type {VouchesTable} */
    static Table = VouchesTable;

    constructor(table, vouchData) {

        super(table, vouchData)

        /** @type {string} */
        this.id_vouch
        if (!this.id_vouch) this.setId()
        
        /** @type {string} */
        this.user_id

        /** @type {number} */
        this.id_position

        /** @type {?string} */
        this.executor_id

        /** @type {number} */
        this.given_at

        /** @type {number} */
        this.worth

        /** @type {?string} */
        this.comment

    }

    isPositive() {
        return (this.worth > 0);
    }

    isPurge() {
        return this.worth === -2;
    }

    isVoteOutcome() {
        return !this.executor_id;
    }
    
    isHidden() {
        return !this.isPositive() && !this.isVoteOutcome();
    }

    isExpired() {
        if (this.isVoteOutcome()) return false;
        if (this.worth < 0) return (Date.now()/1000) >= this.given_at+(60*60*24*7*2);
        return (Date.now()/1000) >= this.given_at+(60*60*24*30.41*4);
    }

    /**
     * @param {string} [id_vouch] if falsely will use a random uuid
     */
    setId(id_vouch) {

        this.id_vouch = id_vouch || this.client.generateUUID()
        return this;

    }

    get userProfile() {
        return this.client.users.cache.find(this.user_id);
    }

    get user() {
        if (!this.bot || !this.user_id) return null;
        return this.bot.users.resolve(this.user_id);
    }

    /** @param {string|UserProfile|import('discord.js').User} user */
    setUser(user) {
        this.user_id = user?.id ?? user?.user_id ?? user
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

    get executorProfile() {
        return this.client.users.cache.find(this.executor_id);
    }

    get executor() {
        if (!this.bot || !this.executor_id) return null;
        return this.bot.users.resolve(this.executor_id);
    }

    /** @param {string|import('./user_profile')|import('discord.js').User|null} executor */
    setExecutor(executor) {
        this.executor_id = executor?.user_id ?? executor?.id ?? executor
        return this;
    }

    /**
     * @param {number} given_at if undefined will use current time 
     */
    setGivenAt(given_at = Math.floor(Date.now()/1000)) {
        this.given_at = given_at
        return this;
    }

    /** @param {number} worth */
    setWorth(worth) {
        this.worth = worth
        return this;
    }

    /** @param {string|null} comment */
    setComment(comment) {
        this.comment = comment
        return this;
    }

    /** 
     * @override
     * @param {Object.<string, any>} vouchData 
     */
    update(vouchData) {
        super.update(vouchData)
        this.setPosition(vouchData.position)
        return this;
    }

    isCacheExpired(now) {
        return this.isExpired() && (!now || super.isCacheExpired(now));
    }

    /**
     * @param {I18n} i18n
     * @param {?Role} [councilRole] 
     * @param {?number} idx
     * @returns {import("discord.js").EmbedField}
     */
    toEmbedField(i18n, councilRole = null, idx = null) {
        const time = `<t:${this.given_at}:D>` 

        if (this.executor_id) {
            const resourceId = "vouches.to_field." + (!this.isPositive() ? "negative" : (this.isExpired() ? "expired" : "positive"))
            return i18n.getObject(
                resourceId, this.executorProfile?.mention ?? 'Unknown User', 
                this.comment || undefined, this.executorProfile?.username, time, idx || undefined
            )
        }

        const resourceId = "vouches.to_field." + (this.isPositive() ? "accepted" : this.isPurge() ? "purged" : "denied")
        return i18n.getObject(resourceId, councilRole ? `${councilRole}` : `council`, this.comment || undefined, time, idx || undefined);
    }

    /**
     * @param {I18n} i18n
     * @param {?number} idx
     */
    asString(i18n, idx = null) {
        if (this.executor_id) {
            const resourceId = "vouches.as_string." + (this.isPositive() ? "positive" : "negative")
            return i18n.get(resourceId, idx || undefined, this.executor?.username ?? this.executorProfile?.username, this.comment || undefined)
        }

        const resourceId = "vouches.as_string." + (this.isPositive() ? "accepted" : this.isPurge() ? "purged" : "denied")
        return i18n.get(resourceId, idx || undefined, this.comment || undefined);
    }

}

module.exports = ScrimsVouch;