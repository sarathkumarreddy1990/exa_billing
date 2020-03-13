const express = require('express');
const shared = require('../../shared');
const { checkSession } = require('../../controllers/auth');
const { sendError } = require('../../shared/http');

const app = express();

const sendInvalidSession = function (req, res) {
    sendError(req, res, {
        code: 'INVALID_SESSION',
        description: 'INVALID SESSION'
    });
};

app.use(async function (req, res, next) {

    let passed_session = false;

    if (req.query.sessionID || req.body.sessionID) {
        passed_session = req.query.sessionID || req.body.sessionID;
    }

    if (req.query.session_id) {
        passed_session = shared.base64Decode(req.query.session_id);
    }

    if (!req.isAuthenticated() && !passed_session && !req.session.id) {
        return sendInvalidSession(req, res);
    }

    let sessionID = passed_session || req.session.id;

    // if the session is currently valid, update the session information and allow the user to continue
    let args = {
        'user_id': req.session.user_id,
        'session_id': sessionID,
        'screen_name': shared.getCookieOption(req.cookies, 5),
        'user_name': req.session.user_name,
        'sessionStore': req.sessionStore
    };

    args.screen_name = args.screen_name.split('__')[0] || args.screen_name;

    const isValidSession = await checkSession(args);

    if (isValidSession) {
        return next();
    }

    return sendInvalidSession(req, res);
});

module.exports = app;
