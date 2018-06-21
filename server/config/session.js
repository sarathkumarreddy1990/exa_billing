const config = require('./');
const session = require('express-session');
const passport = require('passport');
const flash = require('connect-flash');
const RedisStore = require('connect-redis')(session);

const logger = require('../../logger');

passport.serializeUser(function (user, done) {
    done(null, user);
});

passport.deserializeUser(function (userInfo, done) {
    done(null, userInfo);
});

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

    logger.info('Initializing Session..');

    app.use(passport.initialize());
    app.use(passport.session());
    app.use(flash());

    logger.info('Session initialized..');
};
