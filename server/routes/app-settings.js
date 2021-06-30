const Router = require('express-promise-router');
const router = new Router();

const appSettingsController = require('../controllers/app-settings');
const httpHandler = require('../shared/http');

router.get('/', async function (req, res) {
    req.params.companyID = req.query.companyId;
    req.params.userID = req.query.userId;
    req.params.siteID = 1;
    const data = await appSettingsController.getData(req.params);
    
    if (data.rows && data.rows.length > 0) {
        let row = data.rows[0];
        const hasCensusRights = row.userInfo.user_type === 'SU' || req.session.screens.indexOf('CENS') > 1;

        row.sessionID = req.session.id;
        row.screens = req.session.screens;
        row.isMobileBillingEnabled = row.isMobileBillingEnabled && row.country_alpha_3_code === 'usa' && hasCensusRights;
    }

    httpHandler.sendRows(req, res, data);
});

module.exports = router;
