const Router = require('express-promise-router');
const router = new Router();

const paymentsController = require('../../controllers/payments/payments');
const httpHandler = require('../../shared/http');
const logger = require('../../../logger');

router.get('/', async function (req, res) {
    req.query.isGetTotal = false;
    const data = await paymentsController.getPayments(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/count', async function (req, res) {
    req.query.isGetTotal = false;
    const data = await paymentsController.getPayments(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/total_amount', async function (req, res) {
    req.query.isGetTotal = true;
    const data = await paymentsController.getPayments(req.query);
    httpHandler.sendRows(req, res, data);
});

router.post('/', async function (req, res) {
    const data = await paymentsController.createOrUpdatePayment(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/', async function (req, res) {
    const data = await paymentsController.createOrUpdatePayment(req.body);
    httpHandler.sendRows(req, res, data);
});

router.post('/applyPayments', async function (req, res) {
    const data = await paymentsController.createOrUpdatePaymentapplications(req.body);
    httpHandler.sendRows(req, res, data);
});

router.delete('/payment', async function (req, res) {
    const data = await paymentsController.deletePayment(req.body);
    httpHandler.sendRows(req, res, data);
});

router.get('/applied_amount', async function (req, res) {
    const data = await paymentsController.getAppliedAmount(req.query.paymentId);
    httpHandler.sendRows(req, res, data);
});

router.get('/invoice_details', async function (req, res) {
    const data = await paymentsController.getInvoiceDetails(req.query);
    httpHandler.send(req, res, data);
});

router.post('/apply_invoice_payments', async function (req, res) {
    const data = await paymentsController.createInvoicePaymentapplications(req.body);
    httpHandler.sendRows(req, res, data);
});

router.get('/study_cpt_details', async function (req, res) {
    const data = await paymentsController.getStudyCpt(req.query);
    httpHandler.sendRows(req, res, data);
});

router.post('/apply_tos_payments', async function (req, res) {
    logger.info('Initiating TOS payment..');
    const data = await paymentsController.applyTOSPayment(req.body);
    logger.info('TOS payment process done..');
    httpHandler.sendRows(req, res, data);
});

module.exports = router;
