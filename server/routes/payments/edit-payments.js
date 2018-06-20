const Router = require('express-promise-router');
const router = new Router();

const paymentsController = require('../../controllers/payments/edit-payments');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    const data = await paymentsController.getPendingPayments(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/claim-charges', async function (req, res) {
    const data = await paymentsController.getClaimBasedCharges(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/groupcodes_and_reasoncodes', async function (req, res) {
    const data = await paymentsController.getGroupCodesAndReasonCodes(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/payment_applications', async function (req, res) {
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

router.get('/fee_details', async function (req, res) {
    const data = await paymentsController.getFeeDetails(req.query);
    httpHandler.sendRows(req, res, data);
});

router.put('/payment_delete', async function (req, res) {
    const data = await paymentsController.deletePayment(req.body);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;
