const Router = require('express-promise-router');
const router = new Router();

const adjController = require('../../controllers/setup/adjustment_codes');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    const data = await adjController.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/:id', async function (req, res) {
    const data = await adjController.getDataById(req.params);
    httpHandler.sendRows(req, res, data);
});

router.post('/', async function (req, res) {
    const data = await adjController.createAdjustment(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/', async function (req, res) {
    const data = await adjController.updateAdjustment(req.body);
    httpHandler.sendRows(req, res, data);
});

router.delete('/', async function (req, res) {
    const data = await adjController.deleteAdjustment(req.body);
    httpHandler.sendRows(req, res, data);
});


module.exports = router;