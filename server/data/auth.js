const Redis = require('ioredis');
const moment = require('moment-timezone');
const logger = require('../../logger/index');

module.exports = {

    updateLastAccessed: async function (args) {
        let {
            sessionStore: {
                client: {
                    options
                }
            },
            session_id,
            screen_name,
            current_screen_id,
            current_screen = screen_name || ''
        } = args;

        let currentKeyPrefix = options.keyPrefix;

        /**
        * Re-assign redis keyprefix to get users session details
        */

        if (options && options.keyPrefix && options.keyPrefix.indexOf('user_sessions') === -1) {
            let oldPrefix = options.keyPrefix.split(':');
            oldPrefix[2] = 'user_sessions';
            currentKeyPrefix = oldPrefix.join(':');
        }

        const combinedOptions = {
            ...options,
            'keyPrefix': `${currentKeyPrefix}`,
            'connectionName': `billing-session`,
        };
        const user_session_client = new Redis(combinedOptions);

        /**
        * Update interval change in redis so activity checks reflect correctly
        */
        let currentSession = await user_session_client.hgetall(session_id);

        /**
         * After expiration (session interval + log in time) session expires and returns empty/0
         * - may come back as a string `0` so will force type
         */

        if ( !currentSession || Object.keys(currentSession).length === 0 ) {
            user_session_client.quit();
            return false;
        }

        const now = moment().format();
        const newEntry = (
            current_screen !== currentSession.current_screen ||
            current_screen_id !== currentSession.current_screen_id
        );

        const entry_dt = newEntry
            ? [ `entry_dt`, now ]
            : [];

        /**
         * If newly passed "current_screen" is blank, don't change from existing
         */
        const current_screen_data = current_screen
            ? [
                `current_screen`, current_screen,
                `current_screen_id`, current_screen_id,
            ]
            : [
                `current_screen`, currentSession.current_screen,
                `current_screen_id`, currentSession.current_screen_id,
            ];

        const newSessionData = [
            `last_access_dt`, now,
            ...entry_dt,
            ...current_screen_data,
        ];

        const multi = user_session_client.multi();
        multi.hmset(session_id, newSessionData);
        multi.expire(session_id, ~~currentSession.session_interval * 60);

        let error = null;
        let results = [];

        try {
            results = await multi.exec();
            user_session_client.quit();
        }
        catch ( e ) {
            user_session_client.quit();
            logger.logError(`User access/session read failure - could not read from redis`, e);
            error = e;
            return false;
        }

        /**
        * `results` looks like [ [ ?ReplyError, 'OK' or result ], ...[] ]
        */
        const [
            sessionSet = [],
            sessionExpire = []
        ] = results;

        return !sessionSet[0] && !sessionExpire[0] && sessionSet[1] === `OK`;

    }
};
