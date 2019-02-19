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

    // if (!req.isAuthenticated()) {
    //     return sendInvalidSession(req, res);
    // }

    // if (!req.session.id) {
    //     return sendInvalidSession(req, res);
    // }

    const isValidSession = await checkSession(sessionID);

    if (isValidSession) {
        return next();
    }

    return sendInvalidSession(req, res);
});

module.exports = app;
