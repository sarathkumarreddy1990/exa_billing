const Router = require('express-promise-router');
const router = new Router();

const eraController = require('../../controllers/era/era');
const httpHandler = require('../../shared/http');

router.get('/', async function (req, res) {
    const data = await eraController.getEraFiles(req.query);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;
