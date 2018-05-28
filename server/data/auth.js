const { queryRows, SQL } = require('./index');

module.exports = {

    getExpiredTimeout: async function (sessionID) {
        let sql = SQL`
                SELECT    user_log.id, 
                        Now()                                                                       AS currenttime,
                        Extract(minute FROM Now() - user_log.last_access_dt)                        AS expired_timeout,
                        cast(COALESCE(users.user_settings->\'sessionInterval\', \'30\') AS integer) AS session_timeout 
                FROM      user_log 
                LEFT JOIN users 
                ON        users.id = user_log.user_id 
                WHERE     user_log.session_id = ${sessionID} 
                AND       NOT user_log.has_expired
        `;

        return await queryRows(sql);
    },

    updateLastAccessed: async function (sessionID) {

        let sql = SQL`
                UPDATE user_log
                SET last_access_dt = now()
                WHERE session_id = ${sessionID} AND NOT has_expired
        `;

        return await queryRows(sql);
    }
};
