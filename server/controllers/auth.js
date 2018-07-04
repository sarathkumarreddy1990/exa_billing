const cache = require('../../modules/cache');
const data = require('../data/auth');

const cacheDuration = 1;    ///minutes

module.exports = {

    checkSession: async function (sessionID) {

        if (cache.get(sessionID)) {
            return true;
        }

        const response = await data.getExpiredTimeout(sessionID);

        if (response.length <= 0) {
            return false;
        }

        const { expired_timeout, session_timeout } = response[0];

        if (expired_timeout > session_timeout) {
            return false;
        }

        await data.updateLastAccessed(sessionID);
        cache.put(sessionID, true, 1000 * 60 * cacheDuration);

        return true;
    }
};
