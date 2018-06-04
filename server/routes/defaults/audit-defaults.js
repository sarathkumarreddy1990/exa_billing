const express = require('express');
const shared = require('../../shared');

const app = express();

app.use(function (req, res, next) {

    if (['POST', 'PUT', 'DELETE'].indexOf(req.method) > -1) {
        req.body = req.body || {};

        let {
            screenName,
            moduleName
        } = shared.getScreenDetails(req.path);

        if (!screenName) {
            return next();
        }

        req.body = {
            ...req.body,
            clientIp: 'localhost',
            userId: req.session.user_id,
            companyId: req.session.company_id,
            screenName: screenName,
            moduleName: moduleName,
        };
    }

    next();
});

module.exports = app;
