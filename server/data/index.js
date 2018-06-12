const { Pool } = require('pg');
const SQL = require('sql-template-strings');
const url = require('url');

const logger = require('../../logger');
const config = require('../config');
const constants = require('../shared/constants');

const dbConnString = config.get(config.keys.dbConnection);

const poolConfig = ((connStr) => {
    const params = url.parse(connStr);
    const auth = params.auth.split(':');

    const config = {
        user: auth[0],
        password: auth[1],
        host: params.hostname,
        port: params.port,
        database: params.pathname.split('/')[1],
        ssl: false
    };

    return config;
})(dbConnString);

poolConfig.application_name = 'exa-billing';
poolConfig.max = 4;
poolConfig.min = 2;
poolConfig.idleTimeoutMillis = 120000;     // close idle clients after 2 minute (default is 30 seconds)

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
    logger.error('PG POOL on.error: ' + err.message);
});

const pgData = {

    query: async function (text, values, preparedName) {
        let queryObj = {};

        if (typeof text === 'object') {
            queryObj = text;
        } else {
            queryObj = {
                name: preparedName || null,
                text,
                values
            };
        }

        return pool.query(queryObj);
    },

    queryRows: async function (text, values, preparedName) {
        try {
            let result = await pgData.query(text, values, preparedName);
            return result.rows;
        } catch (err) {
            throw err;
        }
    },

    queryWithAudit: async function (query, args) {
        let {
            userId,
            screenName,
            moduleName,
            logDescription,
            clientIp,
            companyId
        } = args;

        let sql = SQL`WITH cte AS (`;
        sql.append(query);

        sql.append(SQL`
                ),
                audit_cte AS (
                    SELECT billing.create_audit(
                        ${companyId},
                        ${screenName},
                        cte.id,
                        ${screenName},
                        ${moduleName},
                        ${logDescription},
                        ${clientIp || '127.0.0.1'},
                        json_build_object(
                            'old_values', (SELECT COALESCE(old_values, '{}') FROM cte),
                            'new_values', (SELECT row_to_json(temp_row)::jsonb - 'old_values'::text FROM (SELECT * FROM cte) temp_row)
                        )::jsonb,
                        ${userId || 0}
                    ) id
                    from cte
                )

                SELECT  *
                FROM    audit_cte
            `);
            
        return await pgData.query(sql);
    },

    constants,

    SQL,
};

module.exports = pgData;
