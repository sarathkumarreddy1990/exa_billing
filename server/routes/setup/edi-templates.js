const Router = require('express-promise-router');
const router = new Router();

const ediController = require('../../controllers/setup/edi-templates');
const httpHandler = require('../../shared/http');

router.get('/default/:flag', async function (req, res) {
    const data = await ediController.getDefaultTemplate(req.params);
    httpHandler.send(req, res, data);
});

router.get('/:flag', async function (req, res) {
    const data = await ediController.getTemplatesList(req.params);
    httpHandler.send(req, res, data);
});

router.get('/:flag/:name', async function (req, res) {
    const data = await ediController.getTemplate(req.params);
    httpHandler.send(req, res, data);
});

router.post('/:flag/:name', async function (req, res) {
    const data = await ediController.createTemplate(req.params, req.audit);
    httpHandler.send(req, res, data);
});

router.put('/:flag/:name', async function (req, res) {
    const data = await ediController.updateTemplate(req.params, req.body);
    httpHandler.send(req, res, data);
});

router.delete('/:flag/:name', async function (req, res) {
    const data = await ediController.deleteTemplate(req.params, req.audit);
    httpHandler.send(req, res, data);
});

module.exports = router;
