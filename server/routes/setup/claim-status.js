const Router = require('express-promise-router');
const router = new Router();

const claimStatusController = require('../../controllers/setup/claim-status');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    const data = await claimStatusController.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/:id', async function (req, res) {
    const data = await claimStatusController.getDataById(req.params);
    httpHandler.sendRows(req, res, data);
});

router.post('/', async function (req, res) {
    const data = await claimStatusController.create(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/', async function (req, res) {
    const data = await claimStatusController.update(req.body);
    httpHandler.sendRows(req, res, data);
});

router.delete('/', async function (req, res) {
    const data = await claimStatusController.delete(req.body);
    httpHandler.sendRows(req, res, data);
});

router.delete('/:id', async function (req, res) {
    const data = await claimStatusController.delete(req.params);
    httpHandler.sendRows(req, res, data);
});


module.exports = router;