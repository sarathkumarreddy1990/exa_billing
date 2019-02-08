const express = require('express');
const router = express.Router();
const OHIPModule = require('./index');

module.exports = function(billingApi) {

    const ohip = new OHIPModule(billingApi);

    // TODO this really needs to be a POST handler
    router.get('/sandbox', (req, res) => {
        ohip.sandbox(req.query, (ohipErr, ohipResponse) => {
            // console.log("OHIP Response", ohipResponse);
            return res.send(ohipResponse);
        });
    });

    // example API call:
    // http://localhost/exa_modules/billing/ohip/hcv?healthNumber=1234567890&versionCode=OK
    router.get('/validateHealthCard', (req, res) => {
        ohip.validateHealthCard(req.query, (ohipErr, ohipResponse) => {
            return res.send(ohipResponse);
        });
    });

    return router;
};
