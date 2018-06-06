const Router = require('express-promise-router');
const router = new Router();

const inquiryController = require('../controllers/claim-inquiry');
const httpHandler = require('../shared/http');

router.get('/', async function (req, res) {
    const data = await inquiryController.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/claim_comments', async function (req, res) {
    const data = await inquiryController.getClaimComments(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/claim_comment', async function (req, res) {
    const data = await inquiryController.getClaimComment(req.query);
    httpHandler.sendRows(req, res, data);
});

module.exports = router;