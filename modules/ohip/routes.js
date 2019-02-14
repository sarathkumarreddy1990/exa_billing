const express = require('express');
const router = express.Router();
const OHIPModule = require('./index');

module.exports = function(billingApi) {

    const ohip = new OHIPModule(billingApi);

    router.get('/sandbox', (req, res) => {
        ohip.downloadAndProcessResponseFiles(req.query, (ohipErr, ohipResponse) => {
            return res.send(ohipResponse);
        });
    });

    //TODO needs to be POST
    router.use('/submitClaims', (req, res) => {
        ohip.submitClaims(req.query, (submitErr, submitResponse) => {
            return res.send(submitResponse);
        });
    });

    // example API call:
    // http://localhost/exa_modules/billing/ohip/hcv?healthNumber=1234567890&versionCode=OK
    router.get('/validateHealthCard', (req, res) => {
        ohip.validateHealthCard(req.query, (ohipErr, ohipResponse) => {
            return res.send(ohipResponse);
        });
    });

    // OHIP File Management Screen
    router.get('/fileManagement', (req, res) => {
        ohip.fileManagement(req.query, (ohipErr, ohipResponse) => {
            return res.send(ohipResponse);
        });
    });


    router.get('/downloadRemittanceAdvice', (req, res) => {
        ohip.downloadRemittanceAdvice(req.query, (ohipErr, ohipResponse) => {
            return res.send(ohipResponse);
        });
    });
    return router;
};
