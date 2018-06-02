const Router = require('express-promise-router');
const router = new Router();

const validationsControllers = require('../../controllers/setup/validations');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    const data = await validationsControllers.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.post('/', async function (req, res) {
    const data = await validationsControllers.createOrUpdate(req.body);
    httpHandler.sendRows(req, res, data);
});


module.exports = router;
