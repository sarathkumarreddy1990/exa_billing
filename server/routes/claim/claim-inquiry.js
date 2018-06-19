const Router = require('express-promise-router');
const router = new Router();

const inquiryController = require('../../controllers/claim/claim-inquiry');
const httpHandler = require('../../shared/http');

router.get('/', async (req, res) => {
    const data = await inquiryController.getData(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/claim_comments', async (req, res) => {
    const data = await inquiryController.getClaimComments(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/claim_comment', async (req, res) => {
    const data = await inquiryController.getClaimComment(req.query);
    httpHandler.sendRows(req, res, data);
});

router.post('/claim_comment', async (req, res) => {
    const data = await inquiryController.saveClaimComment(req.body);
    httpHandler.sendRows(req, res, data);
});

router.delete('/', async (req, res) => {
    const data = await inquiryController.deleteClaimComment(req.body);
    httpHandler.sendRows(req, res, data);
});

router.put('/claim_comment', async (req, res) => {
    const data = await inquiryController.updateClaimComment(req.body);
    httpHandler.sendRows(req, res, data);
});

router.get('/followup', async (req, res) => {
    const data = await inquiryController.getFollowupDate(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/payment_details', async (req, res) => {
    const data = await inquiryController.viewPaymentDetails(req.query);
    httpHandler.sendRows(req, res, data);
});

router.get('/charge_payment_details', async (req, res) => {
    const data = await inquiryController.viewChargePaymentDetails(req.query);
    httpHandler.sendRows(req, res, data);
});
    
module.exports = router;