const Router = require('express-promise-router');
var router = new Router();

const autoCompleteController = require('../controllers/autoCompleteDropDown');
const httpHandler = require('../shared/http');

router.get('/', async function (req, res) {
    const data = await autoCompleteController.getCptAutoCompleteDetails(req.query);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;