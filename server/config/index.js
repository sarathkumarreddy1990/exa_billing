const path = require('path');

const nconf = require('nconf');
const logger = require('../../logger');

module.exports = {

    keys: {
        dbConnection: 'dbConnection',
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
