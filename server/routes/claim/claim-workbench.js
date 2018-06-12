const Router = require('express-promise-router');
const router = new Router();

const claimWorkbenchController = require('../../controllers/claim/claim-workbench');
const httpHandler = require('../../shared/http');

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

router.put('/update', async function (req, res) {
    const data = await claimWorkbenchController.updateClaimStatus(req.body);
    httpHandler.sendRows(req, res, data);
});

router.get('/submitClaim', async function (req, res) {
    const data = await claimWorkbenchController.getEDIClaim(req.query);
    httpHandler.send(req, res, data);
});

module.exports = router;
