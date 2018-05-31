const Router = require('express-promise-router');
const router = new Router();

const claimsController = require('../controllers/claims');
const httpHandler = require('../shared/http');

router.get('/get_line_items', async function (req, res) {
    const data = await claimsController.getLineItemsDetails(req.query);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;