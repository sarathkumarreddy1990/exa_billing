const Router = require('express-promise-router');
const router = new Router();

const paymentsController = require('../../controllers/payments/edit-payments');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    const data = await paymentsController.getPendingPayments(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/getClaimBasedCharges', async function (req, res) {
    const data = await paymentsController.getClaimBasedCharges(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/getGroupCodesAndReasonCodes', async function (req, res) {
    const data = await paymentsController.getGroupCodesAndReasonCodes(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/getPayemntApplications', async function (req, res) {
    const data = await paymentsController.getPayemntApplications(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/patient_search', async function (req, res) {
    const data = await paymentsController.getAllPatients(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/patient_count', async function (req, res) {
    const data = await paymentsController.getTotalPatients(req.query);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;
