const express = require('express');
const router = express.Router();
const OHIPModule = require('./index');

const billingApi = {

    applyPayment: (args, callback) => {
        return;
    },
};

const ohip = new OHIPModule(billingApi);
const responseCodes = require('./hcv/responseCodes');

const getRandomResponseCode = (codes) => {
    return codes[Math.floor(Math.random()*codes.length)];
};

const getRandomValidHealthNumberResponseCode = () => {
    return getRandomResponseCode([50, 51, 52, 53, 54, 55]);
};

// TODO this really needs to be POST
router.get('/submitClaims', (req, res) => {
    const ohip = new OHIPModule(billingApi);
    ohip.submitClaims(req.query, (ohipErr, ohipResponse) => {
        return res.send(ohipResponse);
    });
});

// example API call:
// http://localhost/exa_modules/billing/ohip/hcv?healthNumber=1234567890&versionCode=OK
router.get('/validateHealthCard', (req, res) => {


    const ohip = new OHIPModule(billingApi);
    ohip.validateHealthCard(req.query, (ohipErr, ohipResponse) => {
        return res.send(ohipResponse);
    });

});
module.exports = router;
