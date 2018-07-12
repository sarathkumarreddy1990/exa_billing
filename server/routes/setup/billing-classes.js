const Router = require('express-promise-router');
const router = new Router();

const classController = require('../../controllers/setup/billing-classes');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    const data = await classController.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/:id', async function (req, res) {
    const data = await classController.getDataById(req.params);
    httpHandler.sendRows(req, res, data);
});

router.post('/', async function (req, res) {
    const data = await classController.create(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/:id', async function (req, res) {
    const data = await classController.update(req.body);
    httpHandler.sendRows(req, res, data);
});

router.delete('/:id', async function (req, res) {
    
    let params = {
        ...req.params,
        ...req.body,
        ...req.audit
    };

    const data = await classController.delete(params);
    httpHandler.sendRows(req, res, data);


});


module.exports = router;
