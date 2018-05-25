const config = require('./');
const session = require('express-session');
const RedisStore = require('connect-redis')(session);

module.exports = function (app) {
    const redisInfo = config.get(config.keys.RedisStore);

    app.use(session({
        resave: false,
        saveUninitialized: false,
        secret: 'pacs_web',
        store: new RedisStore({
            host: redisInfo.host,
            port: redisInfo.port,
            db: 1,
            prefix: 'exa:session:',
            ttl: 1 * 24 * 60 * 60
        }),
    }));
};
