const Router = require('express-promise-router');
const router = new Router();

const ediController = require('../../controllers/setup/edi-templates');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    const data = await ediController.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/:name', async function (req, res) {
    const data = await ediController.getDataByName(req.params);
    httpHandler.sendRows(req, res, data);
});

router.post('/', async function (req, res) {
    const data = await ediController.create(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/', async function (req, res) {
    const data = await ediController.update(req.body);
    httpHandler.sendRows(req, res, data);
});

router.delete('/', async function (req, res) {
    const data = await ediController.delete(req.body);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;