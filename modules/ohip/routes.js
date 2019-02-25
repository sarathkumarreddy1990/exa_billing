'use strict';

const logger = require('../../logger');
const express = require('express');
const router = express.Router();
const OHIPModule = require('./index');
const claimWorkbenchController = require('../../server/controllers/claim/claim-workbench');
const _ = require('lodash');

module.exports = function (billingApi) {

    const ohip = new OHIPModule(billingApi);

    router.get('/sandbox', (req, res) => {
        ohip.sandbox(req.query, (ohipErr, ohipResponse) => {
            return res.send(ohipResponse);
        });
    });

    router.get('/downloadAndProcessResponseFiles', (req, res) => {
        ohip.downloadAndProcessResponseFiles(req.query, (ohipErr, ohipResponse) => {
            return res.send(ohipResponse);
        });
    });


    //TODO needs to be POST
    router.use('/submitClaims', async (req, res) => {
        console.log("request: ", req.query);

        // req.body.company_id = req.body.companyId;
        // req.body.user_id = req.body.userId;
        // const data = await claimWorkbenchController.getData(req.body);
        // req.body.claimIds = _.map(data.rows, 'claim_id');
        ohip.submitClaims(req, (submitErr, submitResponse) => {
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
            return res.send(ohipResponse.rows);
        });
    });


    router.get('/downloadRemittanceAdvice', (req, res) => {
        ohip.downloadRemittanceAdvice(req.query, (ohipErr, ohipResponse) => {
            return res.send(ohipResponse);
        });
    });

    router.post('/applyRemittanceAdvice', (req, res) => {
        const ohip = new OHIPModule(billingApi);
        ohip.applyRemittanceAdvice(req.body, (ohipResponse) => {
            return res.send(ohipResponse);
        });
    });

    return router;
};
