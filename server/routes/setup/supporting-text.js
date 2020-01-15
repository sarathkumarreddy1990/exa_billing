const Router = require('express-promise-router');
const router = new Router();

const supportingTextController = require('../../controllers/setup/supporting-text');
const httpHandler = require('../../shared/http');


router.post('/labelCpts', async function (req, res) {
    const data = await supportingTextController.labelCpts(req.body);
    httpHandler.sendRows(req, res, data);
});

router.post('/labelModifiers', async function (req, res) {
    const data = await supportingTextController.labelModifiers(req.body);
    httpHandler.sendRows(req, res, data);
});

router.get('/autocompleteCpts', async function (req, res) {
    const data = await supportingTextController.autocompleteCpts(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/autocompleteModifiers', async function (req, res) {
    const data = await supportingTextController.autocompleteModifiers(req.query);
    httpHandler.sendRows(req, res, data);
});

router.post('/findRelevantTemplates', async function (req, res) {
    const data = await supportingTextController.findRelevantTemplates(req.body);
    httpHandler.sendRows(req, res, data);
});

router.get('/:id', async function (req, res) {
    const data = await supportingTextController.getDataById(req.params);
    httpHandler.sendRows(req, res, data);
});

router.get('/', async function (req, res) {
    const data = await supportingTextController.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.post('/', async function (req, res) {
    const data = await supportingTextController.create(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/:id', async function (req, res) {
    const data = await supportingTextController.update(req.body);
    httpHandler.sendRows(req, res, data);
});

router.delete('/:id', async function (req, res) {
    let params = {
        ...req.params,
        ...req.body,
        ...req.audit
    };

    const data = await supportingTextController.delete(params);
    httpHandler.sendRows(req, res, data);

});
module.exports = router;
