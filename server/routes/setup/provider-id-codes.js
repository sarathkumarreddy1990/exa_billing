const Router = require('express-promise-router');
const router = new Router();

const providerIdCodeControllers = require('../../controllers/setup/provider-id-codes');
const httpHandler = require('../../shared/http');

router.get('/:provider_id', async function (req, res) {
    const data = await providerIdCodeControllers.getData(req.query, req.params);
    httpHandler.sendRows(req, res, data);
});

router.get('/:provider_id/:id', async function (req, res) {
    const data = await providerIdCodeControllers.getById(req.params);
    httpHandler.sendRows(req, res, data);
});

router.post('/:provider_id', async function (req, res) {
    req.body.provider_id = req.params.provider_id;
    const data = await providerIdCodeControllers.create(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/:provider_id', async function (req, res) {
    req.body.provider_id = req.params.provider_id;
    const data = await providerIdCodeControllers.update(req.body);
    httpHandler.sendRows(req, res, data);
});

router.delete('/:provider_id/:id', async function (req, res) {
    const data = await providerIdCodeControllers.delete(req.params);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;
