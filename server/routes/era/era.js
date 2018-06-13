const Router = require('express-promise-router');
const router = new Router();

const eraController = require('../../controllers/era/index');
const httpHandler = require('../../shared/http');

router.get('/list', async function (req, res) {

    const data = await eraController.getEraFiles(req.query);
    httpHandler.sendRows(req, res, data);
});

router.post('/process-file', async function (req, res) {
    
    const data = await eraController.processERAFile(req.body);
    httpHandler.send(req, res, data);
});

module.exports = router;
