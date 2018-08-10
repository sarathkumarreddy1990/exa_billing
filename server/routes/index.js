const express = require('express');
const router = express.Router();

const httpHandler = require('../shared/http');
const pkg = require('../../package.json');
const { staticAssetsRoot } = require('../shared/constants');

router.get('/', function (req, res) {
    let currentTheme = 'default';

    if (req.session && req.session.currentTheme && ['default', 'dark'].indexOf(req.session.currentTheme) > -1) {
        currentTheme = req.session.currentTheme;
    }

    res.render('index', {
        title: 'EXA-Billing',
        cssPath: staticAssetsRoot + '/skins/' + currentTheme,
        staticAssetsRoot
    });
});

router.get('/about', function (req, res) {
    httpHandler.send(req, res, {
        version: pkg.version
    });
});

module.exports = router;
