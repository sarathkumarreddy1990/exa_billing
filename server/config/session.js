'use strict';

const config = require('./');
const session = require('express-session');
const passport = require('passport');
const flash = require('connect-flash');
const Redis = require('ioredis');
const RedisStore = require('connect-redis')(session);

const logger = require('../../logger');

passport.serializeUser(function (user, done) {
    done(null, user);
});

passport.deserializeUser(function (userInfo, done) {
    done(null, userInfo);
});

module.exports = function (app, companyId) {
    const redisInfo = config.get(config.keys.RedisStore);
    const redisOptions = {
        password: redisInfo.password,
        db: 0,
        keyPrefix: `${String(companyId).padStart(10, '0')}:web:session:`, // uses web "application" cuz that's where session is
        ttl: 1 * 24 * 60 * 60
    };
    let client;
    if ( redisInfo.clusterNodes && redisInfo.clusterNodes.length > 0 ) {
        client = new Redis.Cluster(redisInfo.clusterNodes, {
            redisOptions,
        });
    }
    else {
        client = new Redis({
            ...redisOptions,
            host: redisInfo.host,
            port: redisInfo.port,
        });
    }

    app.use(session({
        resave: false,
        saveUninitialized: false,
        secret: 'pacs_web',
        store: new RedisStore({
            client,
        }),
    }));

    logger.info('Initializing Session..');

    app.use(passport.initialize());
    app.use(passport.session());
    app.use(flash());

    logger.info('Session initialized..');
};
