const Router = require('express-promise-router');
const router = new Router();

const chController = require('../../controllers/setup/insurance-provider-clearinghouse');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    const data = await chController.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/:insurance_id', async function (req, res) {
    const data = await chController.getDataById(req.params);
    httpHandler.sendRows(req, res, data);
});

router.post('/', async function (req, res) {
    const data = await chController.create(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/:insurance_id', async function (req, res) {
    const data = await chController.update(req.body);
    httpHandler.sendRows(req, res, data);
});

router.delete('/:insurance_id', async function (req, res) {
    let params = {
        ...req.params,
        ...req.audit
    };

    const data = await chController.delete(params);
    httpHandler.sendRows(req, res, data);

});


module.exports = router;
