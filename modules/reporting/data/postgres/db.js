const config = require('../../../../server/config')
    , logger = require('../../../../logger')
    , dbConnString = config.get(config.keys.dbConnection)
    , pgConnStrngParser = require('pg-connection-string').parse
    , pg = require('pg')
    , pgTypes = require('pg').types   //https://github.com/brianc/node-pg-types
    , _ = require('lodash')
    , typeResolver = require('./typeResolver')
    //, Bluebird = require('bluebird')
    , DEBUG_ENABLED = false
    ;

// convert strings to numbers
// pgTypes.setTypeParser(20, function(val) {
//   return parseInt(val)
// })


// create a config to configure both pooling behavior
// and client options
// note: all config is optional and the environment variables
// will be read if the config is not present
// const pgPoolConfig = {
//   user: 'postgres',             //env var: PGUSER
//   database: 'exa_ddi',          //env var: PGDATABASE
//   password: '1q2w3e4r5t',       //env var: PGPASSWORD
//   host: '10.11.250.147',        // Server hosting the postgres database
//   port: 5432,                   //env var: PGPORT
//   max: 10,                      // max number of clients in the pool
//   min: 2,                       // min number of clients in the pool
//   idleTimeoutMillis: 30000,     // how long a client is allowed to remain idle before being closed
//   application_name: 'exa_web_reporting',
//   //ssl:true,
//   Promise: require('bluebird')
// };

// pool constructor does not support passing a Database URL as the parameter.
const pgPoolConfig = pgConnStrngParser(dbConnString);
pgPoolConfig.max = 4;
pgPoolConfig.min = 2;
pgPoolConfig.idleTimeoutMillis = 60000;
pgPoolConfig.application_name = 'exa_web_reporting';
pgPoolConfig.Promise = require('bluebird');

// create the pool somewhere globally so its lifetime lasts for as long as your app is running
const pool = new pg.Pool(pgPoolConfig);


pool.on('error', function (err, client) {
    // if an error is encountered by a client while it sits idle in the pool
    // the pool itself will emit an error event with both the error and
    // the client which emitted the original error
    // this is a rare occurrence but can happen if there is a network partition
    // between your application and the database, the database restarts, etc.
    // and so you might want to handle it and at least log it out
    logger.logInfo('PG POOL: on.error: ' + err.message);
    console.error('PG POOL: on.error', err.message, err.stack)
});



const api = {
    //pool: pool, // direct pool export should not be used, unless absolutely necessarry!!!

    queryForReportData: (queryText, queryParams, rowsAsArray = true) => {
        return api.query(queryText, queryParams, rowsAsArray)   //true /* always return rows as array */
            .then((pgResult) => {
                return api.mapToReportData(pgResult);
            });
    },

    query: (queryText, queryParams, rowsAsArray) => {
        const queryConfig = api.getQueryConfig(queryText, queryParams, rowsAsArray);
        api.logQuery(queryConfig);
        return pool.query(queryConfig);
    },

    getQueryConfig: (queryText, queryParams, rowsAsArrays) => {
        const queryConfig = {
            text: queryText,                     // sql text with optional params ($1, $2, etc, etc)
            values: queryParams || [],           // array of parameters
            rowMode: rowsAsArrays ? 'array' : '' // 'array' - return rows as array of values
        }
        return queryConfig;
    },

    // filter 'raw' PG results with specific items
    mapToReportData: (pgResult) => {
        if (pgResult) {
            const mappedResult = {
                rowCount: pgResult.rowCount,
                rowFormat: pgResult.rowAsArray ? 'array' : 'object',
                rows: pgResult.rows,
                columnCount: pgResult.fields.length,
                columns: _(pgResult.fields).map(item => typeResolver.getPgColumnDefinition(item)).value()   // enrich column definitions with actual PG type names and categories
            };
            return mappedResult;
        }
        return null;
    },

    logQuery: (queryConfig) => {
        if (DEBUG_ENABLED) {
            logger.logInfo('-- ================================================= --');
            logger.logInfo('-- params: ' + JSON.stringify(queryConfig.values, null, 0));
            logger.logInfo('-- mode:   ' + JSON.stringify(queryConfig.rowMode, null, 0));
            logger.logInfo('-- query:  ' + queryConfig.text);
            logger.logInfo('-- ================================================= --');
        }
    }

}

module.exports = api;
