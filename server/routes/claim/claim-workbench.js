const Router = require('express-promise-router');
const router = new Router();

const claimWorkbenchController = require('../../controllers/claim/claim-workbench');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    req.query.company_id = req.query.companyId;
    req.query.user_id = req.query.userId;

    //try {
    const data = await claimWorkbenchController.getData(req.query);
    httpHandler.sendRows(req, res, data);
    // } catch (err) {
    //     httpHandler.sendError(req, res, err);
    // }
});

router.get('/claims_total_records', async function (req, res) {
    req.query.company_id = req.query.companyId;
    req.query.user_id = req.query.userId;
    const data = await claimWorkbenchController.getDataCount(req.query);
    httpHandler.sendRows(req, res, data);
});

router.put('/update', async function (req, res) {
    const data = await claimWorkbenchController.updateClaimStatus(req.body);
    httpHandler.sendRows(req, res, data);
});

router.get('/claim_json', async function (req, res) {
    const data = await claimWorkbenchController.getClaimObject(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/paper_claim_template', async function (req, res) {
    const data = await claimWorkbenchController.getPaperClaimTemplate(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/create_claim', async function (req, res) {
    const data = await claimWorkbenchController.getEDIClaim(req.query);
    httpHandler.send(req, res, data);
});

router.get('/validate_claims', async function (req, res) {
    const data = await claimWorkbenchController.validateClaim(req.query);
    httpHandler.send(req, res, data);
});

module.exports = router;
