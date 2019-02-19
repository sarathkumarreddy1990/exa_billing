const Router = require('express-promise-router');
const router = new Router();
const _ = require('lodash');

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


router.post('/', async function (req, res) {

    req.body.company_id = req.body.companyId;
    req.body.user_id = req.body.userId;
    const data = await claimWorkbenchController.getData(req.body);

    if (req.body.targetType == 'EDI') {

        let claimIds = _.map(data.rows, 'claim_id');
        req.body.claimIds = claimIds.toString();
        const result = await claimWorkbenchController.getEDIClaim(req.body);
        httpHandler.send(req, res, result);

    }
    else if (req.body.targetType == 'VALIDATE') {

        let claimIds = _.map(data.rows, 'claim_id');
        req.body.claim_ids = claimIds;
        const result = await claimWorkbenchController.validateClaim(req.body);

        httpHandler.send(req, res, result);

    }
    else {
        httpHandler.sendRows(req, res, data);
    }

});

router.get('/claims_total_records', async function (req, res) {
    req.query.company_id = req.query.companyId;
    req.query.user_id = req.query.userId;
    const data = await claimWorkbenchController.getDataCount(req.query);
    httpHandler.sendRows(req, res, data);
});

router.put('/claims/update', async function (req, res) {
    const data = await claimWorkbenchController.updateClaimStatus(req.body);
    httpHandler.sendRows(req, res, data);
});

router.post('/claim_json', async function (req, res) {
    const data = await claimWorkbenchController.getClaimObject(req.body);
    httpHandler.sendRows(req, res, data);
});

router.post('/invoice_data', async function (req, res) {
    const data = await claimWorkbenchController.getInvoiceData(req.body);
    httpHandler.sendRows(req, res, data);
});

router.post('/printer_template', async function (req, res) {
    const data = await claimWorkbenchController.getPrinterTemplate(req.body);
    httpHandler.sendRows(req, res, data);
});

router.post('/create_claim', async function (req, res) {
    const data = await claimWorkbenchController.getEDIClaim(req.body);
    httpHandler.send(req, res, data);
});

router.post('/create_ohip_claim', async function (req, res) {
    const data = await claimWorkbenchController.submitOhipClaim(req.body);
    httpHandler.send(req, res, data);
});

router.post('/validate_claims', async function (req, res) {
    const data = await claimWorkbenchController.validateClaim(req.body);
    httpHandler.send(req, res, data);
});

router.get('/charge_check_payment_details', async function (req, res) {
    const data = await claimWorkbenchController.checkChargePaymentDetails(req.query);
    httpHandler.send(req, res, data);
});

router.get('/claim_check_payment_details', async function (req, res) {
    const data = await claimWorkbenchController.checkPaymentDetails(req.query);
    httpHandler.send(req, res, data);
});

router.put('/claim_charge/delete', async function (req, res) {
    const data = await claimWorkbenchController.deleteClaimOrCharge(req.body);
    httpHandler.send(req, res, data);
});

router.get('/claim_study', async function (req, res) {
    const data = await claimWorkbenchController.getClaimStudy(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/billing_payers', async function (req, res) {
    const data = await claimWorkbenchController.getBillingPayers(req.query);
    httpHandler.sendRows(req, res, data);
});

router.put('/billing_payers', async function (req, res) {
    const data = await claimWorkbenchController.updateBillingPayers(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/follow_ups', async function (req, res) {
    const data = await claimWorkbenchController.updateFollowUp(req.body);
    httpHandler.sendRows(req, res, data);
});

router.post('/claims/batch', async function (req, res) {
    const data = await claimWorkbenchController.createBatchClaims(req.body);
    httpHandler.sendRows(req, res, data);
});


router.post('/update_claim_status', async function (req, res) {
    const data = await claimWorkbenchController.updateStatus(req.body);
    httpHandler.sendRows(req, res, data);
});


router.get('/invoice_claims', async function (req, res) {
    const data = await claimWorkbenchController.getClaimDataInvoice(req.query);
    httpHandler.sendRows(req, res, data);
});

router.put('/invoice_no', async function (req, res) {
    const data = await claimWorkbenchController.updateInvoiceNo(req.body);
    httpHandler.sendRows(req, res, data);
});

router.get('/claim_summary', async function (req, res) {
    const data = await claimWorkbenchController.getClaimSummary(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/claims_total_balance', async function (req, res) {
    req.query.company_id = req.query.companyId;
    req.query.user_id = req.query.userId;
    const data = await claimWorkbenchController.getClaimTotalBalance(req.query);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;
