const { Guild } = require("discord.js");

const PermissionData = require("../permission_data");
const UserPosition = require("../user_position");
const UserProfile = require("../user_profile");
const Position = require("../position");

class UserPermissionsCollection {

    constructor(database, userId) {

        Object.defineProperty(this, "client", { value: database })

        /** 
         * @readonly
         * @protected
         * @type {import('../../postgresql/database')} 
         */
        this.client

        /** 
         * @readonly
         * @type {string} 
         */
        this.userId = userId
        
        /** 
         * @protected
         * @type {Object.<string, UserPosition>} 
         */
        this.userPositions

    }
    
    get user() {
        const profile = this.client.users.cache.find(this.userId)
        return profile || UserProfile.resolve(this.bot.users.resolve(this.userId));
    }

    get bot() {
        return this.client.bot;
    }

    size() {
        return this.get().length;
    }

    getUserPositions() {
        return Object.values(this.userPositions).sort(UserPosition.sortByLevel);
    }

    /** @param {UserPosition} userPosition */
    addUserPosition(userPosition) {
        this.userPositions[userPosition.id_position] = userPosition
        return this;
    }
    
    /** @param {UserPosition} userPosition */
    removeUserPosition(userPosition) {
        delete this.userPositions[userPosition.id_position]
        return this;
    }

    /** @returns {import("../../discord-bot/permissions").UserPermissionInfo[]} */
    get() {
        return this.getUserPositions();
    }

    getPositions() {
        if (!this.bot) return [];
        return this.bot.permissions.getPermittedPositions(this.userId, this);
    }

    getGuildPositionRoles(guild_id) {
        return this.client.positionRoles.cache.get({ guild_id });
    }

    /** 
     * @protected
     * @param {import("../position").PositionResolvable} positionResolvable 
     */
    resolvePosition(positionResolvable) {
        return this.client.positions.cache.find(Position.resolve(positionResolvable));
    }

    /** 
     * @protected
     * @param {import("../position").PositionResolvable} positionResolvable 
     */
    resolvePositionId(positionResolvable) {
        return this.resolvePosition(positionResolvable)?.id_position ?? null;
    }

    async fetch() {
        this.setUserPositions(await this.client.userPositions.sqlFetch({ user_id: this.userId }))
        return this;
    }

    /** @param {PermissionData} permissions */
    set(permissions) {
        this.setUserPositions(permissions.getUserPositions(this.userId))
        return this;
    }

    /** @param {UserPosition[]} userPositions */
    setUserPositions(userPositions) {
        this.userPositions = Object.fromEntries(userPositions.filter(v => !v.isExpired()).map(v => [v.id_position, v]));
    }

    /** 
     * @param {import("../position").PositionResolvable} positionResolvable 
     * @returns {import("../../discord-bot/permissions").UserPermissionInfo|undefined|false}
     */
    hasPosition(positionResolvable) {
        const id_position = this.resolvePositionId(positionResolvable)
        if (!id_position) return undefined;
        return this.userPositions[id_position] ?? false;
    }

    /**
     * @param {import("../../discord-bot/permissions").Permissions} permissions
     * @param {Guild} [guild]
     */
    hasPermission(permissions, guild) {
        if (!this.bot) return undefined;
        return this.bot.permissions.hasPermission(this.userId, this, guild?.members?.cache?.get(this.userId), permissions);
    }

    /** @param {import("discord.js").GuildMember} member */
    getPermittedPositionRoles(member) {
        return this.getGuildPositionRoles(member.guild.id)
            .filter(({ position }) => this.hasPosition(position))
    }

    /** @param {import("discord.js").GuildMember} member */
    getMissingPositionRoles(member) {
        return this.getPermittedPositionRoles(member)
            .filter(({ role_id }) => !member.roles.cache.has(role_id))
            .filter(({ role }) => role && this.bot?.hasRolePermissions(role))
    }

    /** @param {import("discord.js").GuildMember} member */
    getForbiddenPositionRoles(member) {
        const permittedRoles = this.getPermittedPositionRoles(member).map(({ role_id }) => role_id)
        return this.getGuildPositionRoles(member.guild.id)
            .filter(({ role_id }) => !permittedRoles.includes(role_id))
            .filter(({ id_position }) => this.hasPosition(id_position) === false)
    }

    /** @param {import("discord.js").GuildMember} member */
    getWrongPositionRoles(member) {
        return this.getForbiddenPositionRoles(member)
            .filter(({ role_id }) => member.roles.cache.has(role_id))
            .filter(({ role }) => role && this.bot?.hasRolePermissions(role))
    }

}

module.exports = UserPermissionsCollection;