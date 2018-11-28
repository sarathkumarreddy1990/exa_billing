const Router = require('express-promise-router');
const router = new Router();

const appSettingsController = require('../controllers/app-settings');
const i18nData = require('../shared/i18n');
const httpHandler = require('../shared/http');

router.get('/', async function (req, res) {
    req.params.companyID = req.query.companyId;
    req.params.userID = req.query.userId;
    req.params.siteID = 1;
    const data = await appSettingsController.getData(req.params);

    if (data.rows && data.rows.length > 0) {
        data.rows[0].sessionID = req.session.id;
        data.rows[0].screens = req.session.screens;
    }

    httpHandler.sendRows(req, res, data);
});

router.get('/i18n/:culture', async function (req, res) {

    let { culture } = req.params;

    if (!culture) {
        return httpHandler.sendError(req, res, { code: 'INVALID LANG' }, null);
    }

    if (culture === 'undefined.json') {
        culture = 'default.json';
    }

    let data = await i18nData.getI18nData(culture);
    httpHandler.send(req, res, data);
});

module.exports = router;
