const express = require('express');
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

    if (!req.isAuthenticated()) {
        return sendInvalidSession(req, res);
    }

    if (!req.session.id) {
        return sendInvalidSession(req, res);
    }

    const isValidSession = await checkSession(req.session.id);

    if (isValidSession) {
        return next();
    }

    return sendInvalidSession(req, res);
});

module.exports = app;
