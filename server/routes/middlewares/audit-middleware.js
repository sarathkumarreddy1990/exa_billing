const express = require('express');
const shared = require('../../shared');

const app = express();

app.use(function (req, res, next) {

    let ids = {
        userId: req.session.user_id,
        companyId: req.session.company_id,
    };

    if (['POST', 'PUT', 'DELETE'].indexOf(req.method) > -1) {
        req.body = req.body || {};

        let {
            screenName,
            moduleName,
            entityName
        } = shared.getScreenDetails(req.path);

        if (!screenName) {
            return next();
        }

        req.audit = {
            ...ids,
            screenName,
            moduleName,
            entityName,
            clientIp: '127.0.0.1',
        };

        req.body = {
            ...req.body,
            ...req.audit,
        };

        return next();
    }

    if (req.method === 'GET') {
        req.query = {
            ...req.query,
            ...ids,
        };

        req.params = {
            ...req.params,
            ...ids,
        };

        return next();
    }

    next();
});

module.exports = app;
