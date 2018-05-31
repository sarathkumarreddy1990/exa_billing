const Router = require('express-promise-router');
const router = new Router();

const paymentsController = require('../controllers/edit-payments');
const httpHandler = require('../shared/http');

router.get('/', async function (req, res) {
    const data = await paymentsController.getpendingPayments(req.query);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;
