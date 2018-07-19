const path = require('path');

const nconf = require('nconf');
const logger = require('../../logger');

const siteID = 1;

module.exports = {

    keys: {
        dbConnection: 'dbConnection',
        dbConnectionBilling: 'dbConnectionBilling',
        RedisStore: 'RedisStore',
        dbCacheEnabled: 'dbCacheEnabled',
        dbCacheTtl: 'dbCacheTtl'
    },

    paths: [
        path.join(__dirname, '../../../cfg/web.json'), // new path outside of the web tree
        path.join(__dirname, 'web.json') // legacy path
    ],

    loadConfigFile: function () {

        return new Promise((resolve, reject) => {

            for (let i = 0; i < this.paths.length; ++i) {
                const _path = this.paths[i];

                logger.info(`Loading config from: ${_path}`);
                nconf.file(_path);

                if (Object.keys(nconf.stores.file.store || {}).length === 0) {
                    logger.info(`Failed to load config from: ${_path}`);
                    return reject('Failed to load config');
                }

                return resolve(this);
            }

            return reject('No cfg files found');
        });
    },

    initialize: async function () {
        await this.loadConfigFile();

        const configData = require('../data/config-data');

        const rows = await configData.read(siteID);

        if (rows && rows.constructor.name === 'Error') {
            logger.error('Failed to load web_config - ensure update_db has been run successfully');
            return;
        }

        const options = rows[0].web_config;
        this.setKeys(options);

        return true;
    },

    setKeys: function (options) {
        Object.assign(this.keys, options.reduce((keys, obj) => {
            keys[obj.id] = obj.id;
            return keys;
        }, {}));
    },

    set: function (key, value, callback) {
        nconf.set(key, value);

        if (typeof callback === 'function') {
            return callback();
        }
    },

    get: function () {
        if (arguments.length) {
            if (arguments[0]) {
                return nconf.get(arguments[0]);
            }
        } else {
            return nconf.get();
        }
    },

    save: function (callback) {
        nconf.save(callback);
    },
};
