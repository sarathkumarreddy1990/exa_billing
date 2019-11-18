const cache = require('../../modules/cache');
const data = require('../data/auth');

const cacheDuration = 1;    ///minutes

module.exports = {

    checkSession: async function (args) {

        if (cache.get(args.session_id)) {
            return true;
        }

        const response = await data.updateLastAccessed(args);

        if (!response) {
            return false;
        }

        cache.put(args.session_id, true, 1000 * 60 * cacheDuration);

        return true;
    }
};
