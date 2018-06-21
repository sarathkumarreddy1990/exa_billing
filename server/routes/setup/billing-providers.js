const Router = require('express-promise-router');
const router = new Router();

const billingProviderControllers = require('../../controllers/setup/billing-providers');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    const data = await billingProviderControllers.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/:id', async function (req, res) {
    const data = await billingProviderControllers.getById(req.params);
    httpHandler.sendRows(req, res, data);
});

router.post('/', async function (req, res) {
    const data = await billingProviderControllers.create(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/:id', async function (req, res) {
    const data = await billingProviderControllers.update(req.body);
    httpHandler.sendRows(req, res, data);
});

router.delete('/:id', async function (req, res) {
    let params = {
        ...req.params,
        ...req.audit
    };

    const data = await billingProviderControllers.delete(params);
    httpHandler.sendRows(req, res, data);

});

module.exports = router;