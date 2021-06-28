const { Pool } = require('pg');
const SQL = require('sql-template-strings');
const url = require('url');
const logger = require('../../logger');
const config = require('../config');
const constants = require('../shared/constants');

const dbConnString = config.get(config.keys.dbConnectionBilling);
const dbConnectionPoolingEnabled = config.get(config.keys.dbConnectionPoolingEnabled);

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

poolConfig.application_name = 'exa_billing';
poolConfig.max = 4;
poolConfig.min = 2;
poolConfig.idleTimeoutMillis = 120000;     // close idle clients after 2 minute (default is 30 seconds)
poolConfig.connectionTimeoutMillis = 75000;

if (dbConnectionPoolingEnabled === false) {
    // disable DB pooling when using dedicated connection pooling middleware (pgpool-II, Heimdall Data, pgBouncer, etc, etc)
    poolConfig.min = Infinity;
    poolConfig.max = Infinity;
    poolConfig.idleTimeoutMillis = 1;
    poolConfig.evictionRunIntervalMillis = 1;
    logger.info(`PID: ${process.pid}, PG POOL (${poolConfig.application_name}): Connection pooling is disabled`);
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
    logger.error(`PID: ${process.pid}, PG POOL (${poolConfig.application_name}): on.error - ${err.message}`, err);
});

// uncomment to debug DB pool usage
/*
pool.on('connect', function (client) {
    logger.info(`PID: ${process.pid}, PG POOL (${poolConfig.application_name}): on.connect - totalCount: ${pool.totalCount}, idleCount: ${pool.idleCount}, waitingCount: ${pool.waitingCount}`);
});

pool.on('acquire', function (client) {
    logger.info(`PID: ${process.pid}, PG POOL (${poolConfig.application_name}): on.aquire - totalCount: ${pool.totalCount}, idleCount: ${pool.idleCount}, waitingCount: ${pool.waitingCount}`);
});

pool.on('remove', function (client) {
    logger.info(`PID: ${process.pid}, PG POOL (${poolConfig.application_name}): on.remove - totalCount: ${pool.totalCount}, idleCount: ${pool.idleCount}, waitingCount: ${pool.waitingCount}`);
});
*/

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

        try {
            let response = await pool.query(queryObj);
            return response;
        } catch (err) {
            logger.error(err);
            return err;
        }
    },

    queryRows: async function (text, values, preparedName) {
        try {
            let result = await pgData.query(text, values, preparedName);
            return result.rows;
        } catch (err) {
            //logger.error(err);
            return err;
        }
    },

    queryWithAudit: async function (query, args) {
        let {
            userId,
            entityName,
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
                        ${entityName || screenName},
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

    queryCteWithAudit: async function (query, args) {
        let {
            userId,
            entityName,
            screenName,
            moduleName,
            logDescription,
            clientIp,
            companyId
        } = args;

        let sql = SQL``;
        sql.append(query)
        .append(SQL
            `
            SELECT billing.create_audit(
                ${companyId},
                ${entityName || screenName},
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
            ) AS id
            FROM cte
            `);

        return await pgData.query(sql);
    },

    createAudit: async function (args) {
        let {
            userId,
            entityName,
            entityKey,
            screenName,
            moduleName,
            logDescription,
            clientIp,
            companyId,
            oldData,
            newData
        } = args;

        let changes = {
            old_values: oldData || {},
            new_values: newData || {}
        };

        let sql = SQL`
                SELECT * FROM billing.create_audit(
                        ${companyId},
                        ${entityName || screenName},
                        ${entityKey || 1},
                        ${screenName},
                        ${moduleName},
                        ${logDescription},
                        ${clientIp || '127.0.0.1'},
                        ${JSON.stringify(changes)}::jsonb,
                        ${userId || 0}
                    )
            `;

        return await pgData.query(sql);
    },

    constants,

    SQL,
};

module.exports = pgData;
