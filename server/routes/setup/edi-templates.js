const Router = require('express-promise-router');
const router = new Router();

const ediController = require('../../controllers/setup/edi-templates');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    const data = await ediController.getTemplatesList(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/:name/:flag', async function (req, res) {
    const data = await ediController.getTemplate(req.params);
    httpHandler.sendRows(req, res, data);
});

router.post('/', async function (req, res) {
    const data = await ediController.createTemplate(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/', async function (req, res) {
    const data = await ediController.updateTemplate(req.body);
    httpHandler.sendRows(req, res, data);
});

router.delete('/', async function (req, res) {
    const data = await ediController.deleteTemplate(req.body);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;