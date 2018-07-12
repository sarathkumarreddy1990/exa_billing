const Router = require('express-promise-router');
const router = new Router();

const paperController = require('../../controllers/setup/printer-templates');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    const data = await paperController.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/:id', async function (req, res) {
    const data = await paperController.getDataById(req.params);
    httpHandler.sendRows(req, res, data);
});

router.post('/', async function (req, res) {
    const data = await paperController.create(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/:id', async function (req, res) {
    const data = await paperController.update(req.body);
    httpHandler.sendRows(req, res, data);
});

router.delete('/:id', async function (req, res) {
    let params = {
        ...req.params,
        ...req.body,
        ...req.audit
    } ;
    const data = await paperController.delete(params);
    httpHandler.sendRows(req, res, data);

});


module.exports = router;
