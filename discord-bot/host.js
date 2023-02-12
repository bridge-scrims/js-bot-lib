const { Events, GuildBan, Role, User } = require("discord.js");
const EventEmitter = require("events");

const UserPosition = require("../database/user_position");

class HostGuildManager extends EventEmitter {
    
    constructor(bot, hostId) {
        super()
        
        Object.defineProperty(this, "bot", { value: bot })
        /** 
         * @readonly
         * @type {import("./bot")}
         */
        this.bot
        
        Object.defineProperty(this, "hostId", { value: hostId })
        /** 
         * @readonly
         * @type {string}
         */
        this.hostId
        
        this.database.on('connected', () => this.__addChangeListeners())
    }

    get database() {
        return this.bot.database;
    }

    get permissions() {
        return this.bot.permissions;
    }

    get guild() {
        return this.bot.guilds.cache.get(this.hostId);
    }

    get positionRoles() {
        return this.database.positionRoles.cache.get({ guild_id: this.hostId });
    }

    getMember(userId) {
        return this.guild?.members?.cache?.get(userId)
    }

    hasRole(userId, roleId) {
        return this.permissions.hasRole(this.hostId, userId, roleId);
    }

    isBanned(userId) {
        return this.permissions.isBanned(this.hostId, userId);
    }

    isRoleConfigured(id_position) {
        return this.positionRoles.filter(p => p.id_position === id_position).length > 0;
    }

    /** @protected */
    __addChangeListeners() {

        this.database.ipc.on('user_position_create', msg => this.onPositionCreate(msg.payload).catch(console.error))
        this.database.ipc.on('audited_user_position_remove', msg => this.onPositionRemove(msg.payload).catch(console.error))
        this.database.ipc.on('user_position_remove', msg => this.onPositionRemove({ userPosition: msg.payload }).catch(console.error))
        this.database.ipc.on('user_position_expire', msg => this.onPositionExpire(msg.payload).catch(console.error))

        this.database.ipc.on('audited_position_role_create', msg => this.onPositionRoleChange(msg.payload).catch(console.error))
        this.database.ipc.on('audited_position_role_remove', msg => this.onPositionRoleChange(msg.payload).catch(console.error))
        
        this.bot.permissions.on("update", (...args) => this.onPositionsChange(...args).catch(console.error))
        this.bot.auditedEvents.on(Events.GuildBanAdd, (ban) => this.onBanChange(ban, ban?.executor).catch(console.error))
        this.bot.auditedEvents.on(Events.GuildBanRemove, (ban) => this.onBanChange(ban, ban?.executor).catch(console.error))
        this.bot.on(Events.GuildMemberRemove, (member) => this.onMemberRemove(member).catch(console.error))

    }

    /**
     * @typedef {import("../database/position").PositionResolvable} PositionResolvable
     */

    async onPositionCreate(userPosition) {
        await this.onPositionChange(true, userPosition, userPosition.executor_id)
    }

    async onPositionRemove({ userPosition, executor }) {
        await this.onPositionChange(false, userPosition, executor)
    }

    async onPositionExpire(userPosition) {
        await this.onPositionChange(false, userPosition, undefined)
    }

    async onPositionChange(exists, userPositionData, executor_id) {
        const userPosition = new UserPosition(this.database, userPositionData)
        const expiration = (exists ? userPosition.expires_at : undefined)
        if (userPosition.user) {
            const permissions = await this.bot.permissions.fetchUserPermissions(userPosition.user_id)
            if (exists && !permissions.hasPosition(userPosition.id_position)) permissions.addUserPosition(userPosition)
            this.emit("permissionsUpdate", this.permissions.permissifyUser(userPosition.user, permissions), executor_id, expiration)
        }
    }

    async onPositionRoleChange({ positionRole: { guild_id }, executor }) {
        if (guild_id === this.hostId) {
            const permissions = await this.permissions.fetchData()
            this.guild.members.cache
                .forEach(m => this.emit("permissionsUpdate", this.permissions.permissifyUser(m.user, permissions), executor))
        }
    }

    /** 
     * @param {import("./permissions").PermissibleMember} member
     * @param {?User} executor
     */
    async onPositionsChange(member, executor) {
        if (member.guild.id === this.hostId) {
            this.emit("permissionsUpdate", member.user, executor?.id)
        }
    }

    /** 
     * @param {import("discord.js").PartialGuildMember} member
     */
    async onMemberRemove(member) {
        if (member.guild.id === this.hostId) {
            this.emit("permissionsUpdate", await this.permissions.fetchPermissifyUser(member.user), null)
        }
    }

    /** 
     * @param {GuildBan} ban
     * @param {User} [executor]
     */
    async onBanChange(ban, executor) {
        if (ban.guild.id === this.hostId) {
            this.emit("permissionsUpdate", await this.permissions.fetchPermissifyUser(ban.user), executor?.id)
        }
    }

    /**
     * @param {PositionResolvable} position
     * @returns {Role[]}
     */
    getPositionRequiredRoles(position) {
        return this.permissions.getPositionRequiredRoles(this.hostId, position);
    }

    /**
     * @param {string} userId
     */
    getMemberPositions(userId) {
        const member = this.getMember(userId)
        return member ? this.permissions.getMemberPositions(member) : []
    }

    /**
     * @param {string} userId
     * @param {PositionResolvable} position
     * @returns {Promise<boolean>} if this was successful
     */
    async givePosition(userId, position) {
        const roles = this.getPositionRequiredRoles(position)
        const res = await Promise.all(roles.map(r => this.getMember(userId)?.roles?.add(r)?.catch(() => null)))
        return res.length > 0 && res.every(v => v);
    }

    /**
     * @param {string} userId
     * @param {PositionResolvable} position
     * @returns {Promise<boolean>} if this was successful
     */
    async removePosition(userId, position) {
        const roles = this.getPositionRequiredRoles(position)
        const res = await Promise.all(roles.map(r => this.getMember(userId)?.roles?.remove(r)?.catch(() => null)))
        return res.every(v => v);
    }

    /**
     * This will return **undefined if the result could not be determined**.
     * @param {?string} userId
     * @param {PositionResolvable} position
     */
    hasPosition(userId, position) {
        return this.permissions.hasGuildPosition(this.hostId, userId, position)
    }

}

module.exports = HostGuildManager;