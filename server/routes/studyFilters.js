const Router = require('express-promise-router');
var router = new Router();
const studyFiltersController = require('../controller/studyFilters');
const httpHandler = require('../shared/http');

router.get('/', async function (req, res) {
    const data = await studyFiltersController.getData();
    httpHandler.sendRows(req, res, data);
});

module.exports = router;