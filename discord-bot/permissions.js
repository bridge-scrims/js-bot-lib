const { GuildMember, User } = require("discord.js");
const EventEmitter = require('events');

const UserPermissionsCollection = require("../database/collections/user_permissions");
const PermissionData = require("../database/permission_data");
const PositionRole = require("../database/position_role");
const UserPosition = require("../database/user_position");
const Position = require("../database/position");

class PermissionsManager extends EventEmitter {
    
    constructor(bot) {
        super()

        Object.defineProperty(this, "bot", { value: bot })
        /** 
         * @readonly
         * @type {import("./bot")}
         */
        this.bot

        this.bot.auditedEvents.on("guildMemberRolesUpdate", (oldMember, newMember, executor) => this.onRoleChange(oldMember, newMember, executor).catch(console.error))
    }

    get host() {
        return this.bot.host
    }

    get database() {
        return this.bot.database;
    }

    get positions() {
        return this.database.positions.cache.values();
    }

    /** @protected */
    _resolveGuild(guildId) {
        return this.bot.guilds.cache.get(guildId);
    }

    /** 
     * @protected
     * @param {PositionResolvable} resolvable
     */
    _resolvePosition(resolvable) {
        return this.positions.find(Position.resolve(resolvable))
    }

    async fetchData() {
        return new PermissionData().fetch(this.database);
    }

    async fetchUserPermissions(userId) {
        return (new UserPermissionsCollection(this.database, userId)).fetch();
    }

    /** @typedef {PermissionData|UserPermissionsCollection} UserPermissionsResolvable */

    /** @param {UserPermissionsResolvable} permissions */
    resolveUserPermissions(userId, permissions) {
        if (permissions instanceof UserPermissionsCollection) return permissions;
        return (new UserPermissionsCollection(this.database, userId)).set(permissions);
    }

    /**
     * @param {GuildMember} oldMember 
     * @param {GuildMember} newMember
     * @param {?User} executor
     */
    async onRoleChange(oldMember, newMember, executor) {
        if (executor?.id === newMember.client.user.id) return;
        const oldPositions = this.getMemberPositions(oldMember)
        const newPositions = this.getMemberPositions(newMember)

        const lostPositions = oldPositions.filter(pos => !newPositions.includes(pos))
        const gainedPositions = newPositions.filter(pos => !oldPositions.includes(pos))
        
        if ((lostPositions.length + gainedPositions.length) > 0) {
            this.emit("update", await this.fetchPermissifyMember(newMember), executor, gainedPositions, lostPositions)
        }
    }

    /** 
     * @param {PositionResolvable} position
     * @returns {PositionRole[]}
     */
    getGuildPositionRoles(guild_id, position) {
        position = this._resolvePosition(position)
        return this.database.positionRoles.cache.get({ guild_id }).filter(v => !position || v.id_position === position.id_position);
    }

    /**
     * @typedef {import("../database/position").PositionResolvable} PositionResolvable
     * @typedef Permissible
     * @prop {(perms: Permissions) => boolean | undefined} hasPermission
     * @prop {(pos: PositionResolvable) => Position | false | undefined} hasPosition
     */
    
    /** 
     * @param {GuildMember} member
     */
    async fetchPermissifyMember(member) {
        return this.permissifyMember(member, await this.fetchUserPermissions(member.id)) 
    }

    /** 
     * @param {GuildMember} member 
     * @param {PermissionData|UserPermissionsCollection} permissions
     * @returns {PermissibleMember}
     */
    permissifyMember(member, permissions) {
        member.userPermissions = this.resolveUserPermissions(member.id, permissions)
        member.hasPosition = (pos) => this.hasPosition(member.id, member.userPermissions, pos)
        member.hasPermission = (scrimsPermissions) => this.hasPermission(member.id, member.userPermissions, member, scrimsPermissions)
        this.permissifyUser(member.user, member.userPermissions)
        return member;
    }

    /** 
     * @param {User} user
     */
    async fetchPermissifyUser(user) {
        return this.permissifyUser(user, await this.fetchUserPermissions(user.id)) 
    }

    /** 
     * @param {User} user 
     * @param {PermissionData|UserPermissionsCollection} permissions
     * @returns {PermissibleUser}
     */
    permissifyUser(user, permissions) {
        user.permissions = this.resolveUserPermissions(user.id, permissions)
        user.hasPosition = (pos) => this.hasPosition(user.id, user.permissions, pos)
        user.hasPermission = (scrimsPermissions) => this.hasPermission(user.id, user.permissions, null, scrimsPermissions)
        return user;
    }

    /** 
     * @param {?string} userId 
     * @param {?UserPermissionsCollection} userPositions
     * @returns {UserPermissionInfo[]}
     */
    getPermittedPositions(userId, userPositions) {
        return this.positions
            .sort(Position.sortByLevel)
            .map(p => this.hasPosition(userId, userPositions, p)).filter(v => v);
    }

    /** 
     * @param {GuildMember} member
     * @returns {Position[]}
     */
    getMemberPositions(member) {
        return Array.from(
            new Set(
                this.getGuildPositionRoles(member.guild.id)
                    .filter(posRole => posRole.position && member.roles.cache.has(posRole.role_id))
                    .map(posRole => posRole.position)
            )
        );
    }

    /** 
     * @param {GuildMember} member 
     * @param {?UserPermissionsCollection} userPositions
     */
    getPermittedPositionRoles(member, userPositions) {
        return this.getGuildPositionRoles(member.guild.id)
            .filter(({ position }) => this.hasPosition(member.id, userPositions, position))
    }

    /** 
     * @param {GuildMember} member 
     * @param {?UserPermissionsCollection} userPositions
     */
    getMissingPositionRoles(member, userPositions) {
        return this.getPermittedPositionRoles(member, userPositions)
            .filter(({ role_id }) => !member.roles.cache.has(role_id))
            .filter(({ role }) => role && this.bot.hasRolePermissions(role))
    }

    /** 
     * @param {GuildMember} member 
     * @param {?UserPermissionsCollection} userPositions
     */
    getForbiddenPositionRoles(member, userPositions) {
        const permittedRoles = this.getPermittedPositionRoles(member, userPositions).map(({ role_id }) => role_id)
        return this.getGuildPositionRoles(member.guild.id)
            .filter(({ role_id }) => !permittedRoles.includes(role_id))
            .filter(({ position }) => this.hasPosition(member.id, userPositions, position) === false)
    }

    /** 
     * @param {GuildMember} member 
     * @param {?UserPermissionsCollection} userPositions
     */
    getWrongPositionRoles(member, userPositions) {
        return this.getForbiddenPositionRoles(member, userPositions)
            .filter(({ role_id }) => member.roles.cache.has(role_id))
            .filter(({ role }) => role && this.bot.hasRolePermissions(role))
    }
    
    /**
     * @param {?string} userId
     * @param {?UserPermissionsResolvable} userPermissions
     * @param {?GuildMember} member
     * @param {Permissions} permissions
     */
    hasPermission(userId, userPermissions, member, permissions) {

        if (!userId && !userPermissions) return false;
        if (userId === '568427070020124672') return true;

        const hasRequiredRoles = this._hasRequiredRoles(member, permissions.requiredRoles ?? [])
        const hasRequiredPermissions = this._hasRequiredPermissions(member, permissions.requiredPermissions ?? [])
        const hasRequiredPositions = this._hasRequiredPositions(userId, userPermissions, permissions.requiredPositions ?? [])
        
        const hasPositionLevel = this.hasPositionLevel(userId, userPermissions, permissions.positionLevel ?? null)
        const hasAllowedPositions = this._hasAllowedPositions(userId, userPermissions, permissions.allowedPositions ?? [])
        const hasAllowedPermissions = this._hasAllowedPermissions(member, permissions.allowedPermissions ?? [])
        const hasAllowedRoles = this._hasAllowedRoles(member, permissions.allowedRoles ?? [])
        const hasAllowedUsers = this._hasAllowedUsers(userId, permissions.allowedUsers ?? [])
         
        const allowed = [hasPositionLevel, hasAllowedPositions, hasAllowedPermissions, hasAllowedRoles, hasAllowedUsers]
        return hasRequiredRoles && hasRequiredPermissions && hasRequiredPositions && (allowed.every(v => v === null) || allowed.some(v => v === true));

    }

    /**
     * All the role ids associated with the permissions.
     * @param {string} guildId 
     * @param {Permissions} permissions 
     */
    getPermissionRoles(guildId, permissions) {

        const roles = [
            ...(permissions.requiredRoles ?? []),
            ...(permissions.allowedRoles ?? [])
        ]

        const positions = [
            ...(permissions.requiredPositions ?? []),
            ...(permissions.allowedPositions ?? []),
            ...(this.positions.find(Position.resolve(permissions.positionLevel))?.getPositionLevelPositions() ?? [])
        ]

        positions.forEach(p => (
            this.positions.find(Position.resolve(p))
                ?.getConnectedRoles(guildId)
                ?.forEach(({ id }) => roles.push(id))
        ))
        
        return Array.from(new Set(roles));
    }

    /**
     * @protected
     * @param {GuildMember} member
     * @param {import('discord.js').RoleResolvable[]} roles
     */
    _hasRequiredRoles(member, roles) {
        if (!member) return (roles.length === 0);
        return roles.every(role => member.roles.cache.has(member.roles.resolveId(role)));
    }

    /**
     * @protected
     * @param {GuildMember} member
     * @param {import('discord.js').RoleResolvable[]} roles
     */
    _hasAllowedRoles(member, roles) {
        if (roles.length === 0) return null;
        if (!member) return false;
        return roles.some(role => member.roles.cache.has(member.roles.resolveId(role)));
    }

    /**
     * @protected
     * @param {string} userId
     * @param {string[]} allowedUsers
     */
    _hasAllowedUsers(userId, allowedUsers) {
        if (allowedUsers.length === 0) return null;
        return allowedUsers.includes(userId);
    }

    /**
     * @protected
     * @param {GuildMember} member
     * @param {import('discord.js').PermissionResolvable[]} permissions
     */
    _hasRequiredPermissions(member, permissions) {
        if (!member) return (permissions.length === 0);
        return permissions.every(perm => member.permissions.has(perm, true));
    }

    /**
     * @protected
     * @param {GuildMember} member
     * @param {import('discord.js').PermissionResolvable[]} permissions
     */
    _hasAllowedPermissions(member, permissions) {
        if (permissions.length === 0) return null;
        if (!member) return (permissions.length === 0) ? null : false;
        return permissions.some(perm => member.permissions.has(perm, true));
    }

    /**
     * **If the user is authorized to have this position**
     * *(depending on if they have the correct host roles or the user-positions and sometimes if they are banned)*.
     * This will return **undefined if the result could not be determined** 
     * *(invalid position, host guild not available, invalid userId, no position roles configured)*.
     * @param {?string} userId
     * @param {?UserPermissionsResolvable} userPermissions
     * @param {PositionResolvable} positionResolvable
     * @returns {UserPermissionInfo|false|undefined}
     */
    hasPosition(userId, userPermissions, positionResolvable) {
        if (userPermissions && userId) userPermissions = this.resolveUserPermissions(userId, userPermissions)
        const position = this.positions.find(Position.resolve(positionResolvable))
        if (!position) return undefined;
        const getResult = (v) => ((v === true) ? position : v)

        if (position.name !== "banned" && this.hasPosition(userId, userPermissions, "banned")) return false;
        if (userPermissions?.hasPosition(position)) return userPermissions.hasPosition(position);
		if (!this.host) return undefined;
        return getResult(this.host.hasPosition(userId, position));
    }

    hasRole(guildId, userId, roleId) {
        const guild = this._resolveGuild(guildId)
        if (!guild) return undefined; // bot is not in guild
        // if the guild members couldn't be fetched or something
        if (guild.members.cache.size < 3) return undefined;
        const member = guild.members.cache.get(userId)
        if (!member) return false; // user is not in guild
        return member.roles.cache.has(roleId);
    }

    isBanned(guildId, userId) {
        return this._resolveGuild(guildId)?.bans?.cache?.has(userId);
    }

    /**
     * The Discord roles that are required for the position.
     * @param {PositionResolvable} position
     * @returns {Role[]}
     */
    getPositionRequiredRoles(guildId, position) {
        return this.getGuildPositionRoles(guildId, position).map(p => p.role).filter(v => v);
    }

    /**
     * **If the user is authorized to have a position according to the guild**
     * *(if they have the correct roles and are not banned)*.
     * This will return **undefined if the result could not be determined**
     * *(invalid userId, guildId, guild not available, no position roles configured)*.
     * @param {string} guildId
     * @param {string} userId
     * @param {PositionResolvable} positionResolvable
     */
    hasGuildPosition(guildId, userId, positionResolvable) {
        const position = this._resolvePosition(positionResolvable)
        if (!position) return undefined;

        if (position.name === "banned") return this.isBanned(guildId, userId);
       
        const required = this.getPositionRequiredRoles(guildId, position)
        const has = required.map(role => this.hasRole(guildId, userId, role.id))
        if (has.some(v => v)) return true;
        return (has.length === 0 || has.some(v => v === undefined)) ? undefined : false;
    }

    /**
     * @protected
     * @param {string} userId
     * @param {?UserPermissionsResolvable} userPermissions
     * @param {PositionResolvable[]} requiredPositions
     */
    _hasRequiredPositions(userId, userPermissions, requiredPositions) {
        return requiredPositions.every(r => this.hasPosition(userId, userPermissions, r));
    }

    /**
     * @protected
     * @param {string} userId
     * @param {?UserPermissionsResolvable} userPermissions
     * @param {PositionResolvable[]} allowedPositions
     */
    _hasAllowedPositions(userId, userPermissions, allowedPositions) {
        if (allowedPositions.length === 0) return null;
        return allowedPositions.some(r => this.hasPosition(userId, userPermissions, r));
    }

    /**
     * @param {string} userId
     * @param {?UserPermissionsResolvable} userPermissions
     * @param {PositionResolvable} positionLevel
     * @returns {null|boolean} where null means the position is invalid
     */
    hasPositionLevel(userId, userPermissions, positionLevel) {
        const position = this.positions.find(Position.resolve(positionLevel))
        if (!position) return null;
        return this._hasAllowedPositions(userId, userPermissions, position.getPositionLevelPositions());
    }

}

/**
 * @typedef UserPermissions
 * @prop {PositionResolvable} [positionLevel]
 * @prop {PositionResolvable[]} [allowedPositions]
 * @prop {PositionResolvable[]} [requiredPositions]
 * 
 * @typedef MemberPermissions
 * @prop {import("discord.js").PermissionsString[]} [allowedPermissions]
 * @prop {import("discord.js").PermissionsString[]} [requiredPermissions]
 * 
 * @typedef PermissionsData
 * @prop {string[]} [requiredRoles]
 * @prop {string[]} [allowedRoles]
 * @prop {string[]} [allowedUsers]
 * 
 * @typedef {UserPermissions & MemberPermissions & PermissionsData} Permissions
 * @typedef {UserPosition | Position} UserPermissionInfo
 */

/**
 * @typedef {User & Permissible & PermissibleUserData} PermissibleUser
 * @typedef {GuildMember & Permissible & PermissibleMemberData} PermissibleMember
 * 
 * @typedef PermissibleUserData
 * @prop {UserPermissionsCollection} permissions
 * 
 * @typedef PermissibleMemberData
 * @prop {PermissibleUser} user
 * @prop {UserPermissionsCollection} userPermissions
 */

module.exports = PermissionsManager;