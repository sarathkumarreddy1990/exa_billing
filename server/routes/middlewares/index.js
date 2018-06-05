const express = require('express');
const config = require('../../config');

const gridsMiddleware = require('./grid-middleware');
const auditsMiddleware = require('./audit-middleware');
const rightsMiddleware = require('./rights-middleware');

const app = express();

app.use(function (req, res, next) {
    if (req.originalUrl.indexOf('i18n') == -1 || req.originalUrl.indexOf('wado/v1') == -1) {
        res.setHeader('Cache-Control', 'private, max-age=0, no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
    }

    if (config.get('enableCORS')) {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('X-Super-Powered-By', 'VIZTEK EXA');
    res.setHeader('X-PID', process.pid);

    next();
});

app.use(gridsMiddleware);
app.use(auditsMiddleware);
app.use(rightsMiddleware);

module.exports = app;
