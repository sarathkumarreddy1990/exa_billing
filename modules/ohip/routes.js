const express = require('express');
const router = express.Router();
const OHIPModule = require('./index');

module.exports = function(billingApi) {

    const ohip = new OHIPModule(billingApi);

    router.get('/sandbox', (req, res) => {
        ohip.sandbox(req.query, (ohipErr, ohipResponse) => {
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
        return res.send(JSON.stringify([
            {
                id: 1,
                fileName: "001.720",
                fileType: "Type",
                submittedDate: "28/01/2019",
                isAcknowledgementReceived: true,
                isPaymentReceived: true
            },
            {
                id: 2,
                fileName: "002.424",
                fileType: "Claim",
                submittedDate: "02/02/2019",
                isAcknowledgementReceived: true,
                isPaymentReceived: true
            },
            {
                id: 3,
                fileName: "003.509",
                fileType: "Ack",
                submittedDate: "11/02/2019",
                isAcknowledgementReceived: true,
                isPaymentReceived: false
            }
        ]));
    });

    return router;
};
