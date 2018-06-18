const express = require('express');
const shared = require('../shared');
const logger = require('../../logger');
const config = require('../config');
const cache = require('../../modules/cache');
const auth = require('../controllers/auth');

const cacheDuration = 1;
const app = express();

const logout = function (req, res, msg) {
    if (req.originalUrl === '/exa') {
        res.redirect('/' + req.cookies.company_code + '/login?err=' + msg);
    } else {
        res.send({
            error: {
                code: 'NO_AUTH',
                description: 'Not authenticated'
            }
        });
    }
};

app.use(function (req, res, next) {
    const defaultSession = config.get('defaultSession');

    let passed_session = false;

    if (req.query.sessionID || req.body.sessionID) {
        passed_session = req.query.sessionID || req.body.sessionID;
    }

    if (req.query.session_id) {
        passed_session = shared.base64Decode(req.query.session_id);
    }

    if (!req.isAuthenticated() && !passed_session && !req.session.id) {
        return logout(req, res, 'Not authenticated.');
    }

    let sessionID = passed_session || req.session.id;

    if (cache.get(sessionID)) {
        return next();
    }

    if (passed_session === defaultSession) {
        return next();
    }

    auth.getExpiredTimeout(sessionID)
        .then(result => {

            if (!result.length) {
                return logout(req, res, 'No Valid Session. Please Login again.');
            }

            if (result[0].expired_timeout > result[0].session_timeout) {
                return logout(req, res, 'Session Expired');
            }

            auth.updateLastAccessed(sessionID)
                .then(() => {
                    cache.put(sessionID, true, 1000 * 60 * cacheDuration);
                    return next();
                })
                .catch(err => {
                    logger.error(err);
                    return logout(req, res, 'Not authenticated.');
                });
        })
        .catch(err => {
            logger.error(err);
            return logout(req, res, 'Not authenticated.');
        });
});

module.exports = app;
