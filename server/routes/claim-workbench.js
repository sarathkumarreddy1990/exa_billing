const Router = require('express-promise-router');
const router = new Router();

const claimWorkbenchController = require('../controllers/claim-workbench');
const httpHandler = require('../shared/http');

router.get('/', async function (req, res) {
    req.query.company_id = 1;
    req.query.user_id = 2;    
    const data = await claimWorkbenchController.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/claims_total_records', async function (req, res) {
    req.query.company_id = 1;
    req.query.user_id = 2;    
    const data = await claimWorkbenchController.getDataCount(req.query);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;
