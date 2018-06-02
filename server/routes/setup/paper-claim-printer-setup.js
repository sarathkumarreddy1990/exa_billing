const Router = require('express-promise-router');
const router = new Router();

const paperClaimPrinterSetupControllers = require('../../controllers/setup/paper-claim-printer-setup');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    const data = await paperClaimPrinterSetupControllers.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/:id', async function (req, res) {
    const data = await paperClaimPrinterSetupControllers.getById(req.params);
    httpHandler.sendRows(req, res, data);
});

router.post('/', async function (req, res) {
    const data = await paperClaimPrinterSetupControllers.create(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/', async function (req, res) {
    const data = await paperClaimPrinterSetupControllers.update(req.body);
    httpHandler.sendRows(req, res, data);
});

router.delete('/:id', async function (req, res) {
    const data = await paperClaimPrinterSetupControllers.delete(req.params);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;
