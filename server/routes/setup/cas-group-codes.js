const Router = require('express-promise-router');
const router = new Router();

const casGroupCodeControllers = require('../../controllers/setup/cas-group-codes');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    const data = await casGroupCodeControllers.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/:id', async function (req, res) {
    const data = await casGroupCodeControllers.getById(req.params);
    httpHandler.sendRows(req, res, data);
});

router.post('/', async function (req, res) {
    const data = await casGroupCodeControllers.saveCasGroupCodes(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/', async function (req, res) {
    const data = await casGroupCodeControllers.updateCasGroupCodes(req.body);
    httpHandler.sendRows(req, res, data);
});

router.delete('/', async function (req, res) {
    const data = await casGroupCodeControllers.deleteCasGroupCodes(req.body);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;
