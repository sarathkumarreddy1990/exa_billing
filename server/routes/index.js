const express = require('express');
const router = express.Router();

const httpHandler = require('../shared/http');
const pkg = require('../../package.json');
const { staticAssetsRoot } = require('../shared/constants');
const autobillingData = require('../data/setup/auto-billing');
const siteConfig = require('../../server/config');

router.get('/', function (req, res) {
    let currentTheme = 'default';
    let billingRegionCode= (req.session && req.session.billingRegionCode) || '';
    let censusRights = (req.session?.user_type === 'SU' || req.session?.screens.indexOf('CENS') > 1);

    if (req.session && req.session.currentTheme && ['default', 'dark'].indexOf(req.session.currentTheme) > -1) {
        currentTheme = req.session.currentTheme;
    }

    res.render('index', {
        title: 'EXA-Billing',
        billingRegionCode: billingRegionCode,
        currentTheme: currentTheme,
        csrfToken: req.csrfToken(),
        staticAssetsRoot,
        enableCensus: (siteConfig.get('enableMobileBilling') && censusRights && req.session.country_alpha_3_code === 'usa')
    });
});

router.get('/about', function (req, res) {
    httpHandler.send(req, res, {
        version: pkg.version
    });
});

router.get('/studyStatusChanged', async (req, res) => {
    const abrResults = await autobillingData.executeAutobillingRules(req.query);
    httpHandler.send(req, res, abrResults);
});

module.exports = router;
