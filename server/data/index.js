const { Pool } = require('pg');
const SQL = require('sql-template-strings');
const url = require('url');

const logger = require('../shared/logger');
const config = require('../config');

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

pool.on('error', (err, client) => {
    logger.logInfo('PG POOL on.error: ' + err.message);
});

module.exports = {

    query: async function (text, values, preparedName) {

        let queryObj = {};

        if (typeof text === 'object') {
            queryObj = text;
        } else {
            queryObj = { name: preparedName || null, text, values }
        }
        
        return pool.query(queryObj);
    },

    SQL,
}
