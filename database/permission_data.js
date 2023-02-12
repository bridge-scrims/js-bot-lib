class PermissionData {

    constructor() {

        /**
         * @type {Object.<string, import('./user_position')[]>}
         */
        this.userPositions = []

    }

    /** @param {import('../postgresql/database')} database */
    async fetch(database) {
        const result = await database.userPositions.sqlFetch()
        result.forEach(v => {
            if (v.user_id in this.userPositions) this.userPositions[v.user_id].push(v)
            else this.userPositions[v.user_id] = [v]
        })
        return this;
    }

    getUserPositions(user_id) {
        return this.userPositions[user_id] ?? [];
    }

}

module.exports = PermissionData