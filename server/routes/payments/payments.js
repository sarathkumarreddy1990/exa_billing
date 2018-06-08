const Router = require('express-promise-router');
const router = new Router();

const paymentsController = require('../../controllers/payments/payments');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
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

module.exports = router;
